var _ = require("underscore");
var uuid = require("uuid");

var assert = require("chai").assert;
var expect = require("chai").expect;
var diff = require("deep-object-diff").diff;

var directline = require("./directlineclient");
var utils = require("./utils.js");

var Result = require("./result");

class Test {
    static async perform(context, testData) {
        return await test(context, testData);
    }

    static async run(context, testData) {
        var testResult = await this.perform(context, testData);
        if (testResult.success) {
            context.success(testResult.message);
        }
        else {
            context.failure(testResult.code, testResult.message);
        }
    }
}

async function test(context, testData) {
    context.log("test started");
    context.log("testData: " + utils.stringify(testData));
    // Break the conversation into messages from the user side vs. replies from the bot side
    // Each conversation step contains an array of user messages (typically one) and an array of bot replies (typically one, but it's normal to have more than one)
    // For each conversation step, first send the user message and then wait for the expected reply
    var testUserId = "test-user-" + uuid().substring(0, 8);
    var conversationSteps = createConversationSteps(testData);
    try {
        var initResult = await directline.init(context, testData.secret);
        var conversationResult = await testConversation(context, testUserId, conversationSteps, initResult.conversationId, testData.timeout);
        var message = `${getTestTitle(testData)} passed successfully (${conversationResult.count} ${conversationResult.count == 1 ? "step" : "steps"} passed)`;
        return new Result(true, message);
    }
    catch (err) {
        var reason;
        if (err.hasOwnProperty("details")) {
            reason = err.details;
            if (reason && reason.hasOwnProperty("message")) {
                reason.message = getTestTitle(testData) + ": " + reason.message;
            }
        }
        else {
            reason = getTestTitle(testData) + ": " + err.message;                
        }
        return new Result(false, reason, 500);
    }
}

function createConversationSteps(testData) {
    conversation = [];
    // Assuming that each user message is followed by at least one bot reply

    // Check whether the first message is from the bot
    if (!isUserMessage(testData, testData.messages[0])) {
        // If the first message is from the but, start with a special step with no user message
        conversation.push(new conversationStep(null));
    }
    for (var i = 0; i < testData.messages.length; i++) {
        var message = testData.messages[i];
        if (isUserMessage(testData, message)) {
            // User message - start a new step
            conversation.push(new conversationStep(message));
        }
        else {
            // Bot message - add the bot reply to the current step
            conversation[conversation.length - 1].botReplies.push(message);
        }
    }
    return conversation;
}

function isUserMessage(testData, message) {
    return (testData && testData.userId) ? (message.from.id == testData.userId) : (message.recipient ? (message.recipient.role == "bot") : (message.from.role != "bot")); 
}

function conversationStep(message) {
    this.userMessage = message;
    this.botReplies = [];
}

function testConversation(context, testUserId, conversationSteps, conversationId, defaultTimeout) {
    context.log("testConversation started");
    context.log("testUserId: " + testUserId);
    context.log("conversationSteps: " + utils.stringify(conversationSteps));
    context.log("conversationId: " + conversationId);
    context.log("defaultTimeout: " + defaultTimeout);
    return new Promise(function(resolve, reject) {
        var index = 0;
        function nextStep() {
            if (index < conversationSteps.length) {
                context.log("Testing conversation step " + index);
                var stepData = conversationSteps[index];
                index++;
                var userMessage = createUserMessage(stepData.userMessage, testUserId);
                return testStep(context, conversationId, userMessage, stepData.botReplies, defaultTimeout).then(nextStep, reject);
            }
            else {
                context.log("testConversation end");
                resolve({count: index});
            }
        }
        return nextStep();
    });
}

function createUserMessage(message, testUserId) {
    var userMessage = _.pick(message, "type", "text");
    userMessage.from = {
        id: testUserId,
        name: "Test User"
    };
    return userMessage;
}

function testStep(context, conversationId, userMessage, expectedReplies, timeoutMilliseconds) {
    context.log("testStep started");
    context.log("conversationId: " + conversationId);
    context.log("userMessage: " + utils.stringify(userMessage));
    context.log("expectedReplies: " + utils.stringify(expectedReplies));
    context.log("timeoutMilliseconds: " + timeoutMilliseconds);
    return directline.sendMessage(conversationId, userMessage)
        .then(function(response) {
            var nMessages = expectedReplies.hasOwnProperty("length") ? expectedReplies.length : 1;
            var bUserMessageIncluded = response != null;
            return directline.pollMessages(conversationId, nMessages, bUserMessageIncluded, timeoutMilliseconds);
        })
        .then(function(messages) {
            return compareMessages(context, userMessage, expectedReplies, messages);
        })
        .catch(function(err) {
            var message = `User message '${userMessage.text}' response failed - ${err.message}`;            
            if (err.hasOwnProperty("details")) {
                err.details.message = message;
            }
            else {
                err.message = message;
            }
            throw err;
        });
}

function compareMessages(context, userMessage, expectedReplies, actualMessages) {
    context.log("compareMessages started");
    context.log("actualMessages: " + utils.stringify(actualMessages));
    // Filter out messages from the (test) user, leaving only bot replies
    var botReplies = _.reject(actualMessages, 
                              function(message) {
                                  return message.from.id == userMessage.from.id;
                              });

    expect(botReplies, `reply to user message '${userMessage.text}'`).to.have.lengthOf(expectedReplies.length);

    for (var i = 0; i < expectedReplies.length; i++) {
        var assert = expectedReplies[i].assert || "to.be.equal";
        var expectedReply = expectedReplies[i];
        var botReply = botReplies[i];

        if (botReply.hasOwnProperty("text")) {
            var expr = 'expect(botReply.text, "user message number ' + (i+1) + ' ").' + assert + '(expectedReply.text)';
            eval(expr);
        }
        if (botReply.hasOwnProperty("attachments")) {
            try {
                expect(botReply.attachments,`attachments of reply number ${i+1} to user message '${userMessage.text}'`).to.deep.equal(expectedReply.attachments);
            }
            catch (err) {
                var exception = new Error(err.message);
                exception.details = {message: err.message, expected: err.expected, actual: err.actual, diff: diff(err.expected, err.actual)};
                throw exception;
            }
        }
    }
    return true;
}

function getTestTitle(testData) {
    return `Test ${testData.name? `'${testData.name}'` : `#${testData.index || 0}`}`;
}

module.exports = Test;