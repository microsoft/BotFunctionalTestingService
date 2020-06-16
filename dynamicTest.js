var Test = require("./test");
var _ = require("underscore");
var expect = require("chai").expect;
var diff = require("deep-object-diff").diff;

var directline = require("./directlineclient");
var utils = require("./utils.js");


class DynamicTest extends Test {

    constructor() { super(); }

    checkIfConversationEnded(testData) {
        return testData.lastMessageFromBot && testData.lastMessageFromBot.hasOwnProperty("text") &&
            (testData.lastMessageFromBot.text.trim().includes('Thank you for using this service for COVID-19 Clinical Trials Matching.') ||
                testData.lastMessageFromBot.text.trim() === 'Here are the clinical trials the patient may qualify for:')
    }

    testConversation(context, testUserId, conversationSteps, conversationId, testData) {
        context.log("testConversation started");
        context.log("testUserId: " + testUserId);
        context.log("conversationSteps: " + utils.stringify(conversationSteps));
        context.log("conversationId: " + conversationId);
        context.log("defaultTimeout: " + testData.timeout);
        return new Promise((resolve, reject) => {
            var index = 0;
            let nextStep = () => {
                if (!testData.testEnded) {
                    context.log("Testing conversation step " + index);
                    var stepData = {};
                    if (this.checkIfConversationEnded(testData)) {
                        testData.testEnded = true;
                        stepData.userMessage = testData.lastMessageFromBot;
                    } else if (index > testData.maxSteps) {
                        return reject("max steps reached")
                    }

                    else {
                        stepData.userMessage = testData.lastMessageFromBot;
                    }
                    if (index < conversationSteps.length) {
                        stepData = conversationSteps[index];
                    }

                    index++;
                    var userMessage = this.createUserMessage(stepData.userMessage, testUserId);
                    return this.testStep(context, conversationId, userMessage, stepData.botReplies, testData).then(nextStep, reject);
                }
                else {
                    context.log("testConversation end");
                    resolve({ count: index });
                }
            }
            return nextStep();
        });
    }

    createUserMessage(message, testUserId) {
        return { "type": "message", "text": "<text>", "from": { "id": testUserId, "name": "Test User" } }
    }


    isLastStep(message) {
        return message && message.hasOwnProperty("text") &&
            message.text.trim() === 'What would you like to do?' &&
            message.hasOwnProperty("attachments") &&
            message.attachments[0].content.buttons[0].title === 'Answer additional questions';
    }

    isChoicesQuestion(lastMessageFromBot) {
        return lastMessageFromBot
            && lastMessageFromBot.attachments
            && lastMessageFromBot.attachments.length > 0
            && lastMessageFromBot.attachments[0].content
            && lastMessageFromBot.attachments[0].content.buttons
            && lastMessageFromBot.attachments[0].content.buttons.length > 0
    }

    getFirstChoice(lastMessageFromBot) {
        return lastMessageFromBot.attachments[0].content.buttons[0].value
    }

    createConversationSteps(testData) {
        let conversation = [];
        conversation.push(this.conversationStep(null));
        return conversation;
    }

    matchRegex(lastMessageFromBot, regex) {
        let question = regex;
        return lastMessageFromBot && lastMessageFromBot.hasOwnProperty("text") &&
            question.exec(lastMessageFromBot.text)
    }

    regex = {
        ageQuestions: new RegExp(/age|old/, 'i'),
        genderQuestions: new RegExp(/gender|sex/, 'i'),
        searchQuestions: new RegExp(/search/, 'i'),
        matchingTrials: new RegExp(/(matching clinical trials)|(relevant trials)/, 'i'),
        countryQuestions: new RegExp(/country/, 'i'),
        stateQuestions: new RegExp(/state/, 'i'),
        numericQuestions: new RegExp(/^(what is the patient's).*\?/, 'i'),
        conditionQuestions: new RegExp(/^(what .* condition).*\?/, 'i')
    };

    async testStep(context, conversationId, userMessage, expectedReplies, testData) {
        let pullAnotherMessage = false;
        let messagesToPull = 1;
        if (testData.lastMessageFromBot == undefined) {
            userMessage.text = "begin " + testData.trigger;
        } else if (this.matchRegex(testData.lastMessageFromBot, this.regex.genderQuestions)) {
            userMessage.text = "Female"
        } else if (this.matchRegex(testData.lastMessageFromBot, this.regex.ageQuestions)) {
            userMessage.text = "20"
        } else if (this.matchRegex(testData.lastMessageFromBot, this.regex.countryQuestions)) {
            userMessage.text = "United states"
        } else if (this.matchRegex(testData.lastMessageFromBot, this.regex.searchQuestions)) {
            userMessage.text = "Specific state"
        } else if (this.matchRegex(testData.lastMessageFromBot, this.regex.stateQuestions)) {
            userMessage.text = "CA"
        } else if (testData && testData.lastMessageFromBot && this.isLastStep(testData.lastMessageFromBot)) {
            userMessage.text = "2"; // 2 equals 'Get Results'
        } else if (this.isChoicesQuestion(testData.lastMessageFromBot)) {
            userMessage.text = this.getFirstChoice(testData.lastMessageFromBot); // first choice
        } else if (this.matchRegex(testData.lastMessageFromBot, this.regex.conditionQuestions)) {
            userMessage.text = testData.condition;
        }
        else if (this.matchRegex(testData.lastMessageFromBot, this.regex.numericQuestions)) {
            userMessage.text = "20";
        } else if (this.matchRegex(testData.lastMessageFromBot, this.regex.matchingTrials)) {
            pullAnotherMessage = true;
        } else {
            context.log("error - unrecognized message: " + testData.lastMessageFromBot);
            userMessage.text = "start over";
            messagesToPull = 0;
        }

        context.log("testStep started");
        context.log("conversationId: " + conversationId);
        context.log("userMessage: " + utils.stringify(userMessage));
        context.log("expectedReplies: " + utils.stringify(expectedReplies));
        context.log("timeoutMilliseconds: " + testData.timeout);

        if (pullAnotherMessage) {
                let bUserMessageIncluded = false;
                var botReplies = await directline.pollMessages(conversationId, messagesToPull, bUserMessageIncluded, testData.timeout);
                testData.lastMessageFromBot = botReplies.reverse().find(message => message.text != undefined);
                return true
        } else {
            return directline.sendMessage(conversationId, userMessage)
                .then((response) => {
                    var bUserMessageIncluded = response != null;
                    return directline.pollMessages(conversationId, messagesToPull, bUserMessageIncluded, testData.timeout);
                })
                .then((messages) => {
                    return this.compareMessages(context, userMessage, expectedReplies, messages, testData);
                })
                .catch((err) => {
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
    }


    assertThatCardsFieldsAreNotEmpty(card) {
        let fields = Object.keys(card);
        for (let i = 0; i < fields.length; i++) {
            if (typeof (fields[i]) === 'object') {
                this.assertThatCardsFieldsAreNotEmpty(fields[i]);
            }
            else {
                expect(card[fields[i]], "Cards contains empty field").to.not.be.empty;
            }
        }
    }


    compareMessages(context, userMessage, expectedReplies, actualMessages, testData) {
        context.log("compareMessages started");
        context.log("actualMessages: " + utils.stringify(actualMessages));
        // Filter out messages from the (test) user, leaving only bot replies
        var botReplies = _.reject(actualMessages,
            function (message) {
                return message.from.id == userMessage.from.id;
            });
        testData.lastMessageFromBot = botReplies.reverse().find(message => message.text != undefined);
        for (let i = 0; i < botReplies.length; i++) {
            var botReply = botReplies[i];
            var trialsCountRegex = /Found \d+ relevant trials/g;
            if (botReply.hasOwnProperty("text")) {
                if (botReply.text === "Sorry, no relevant trials were found") {
                    var exception = new Error("Initial trials count is ZERO");
                    exception.details = { message: "Initial trials count is ZERO", expected: "Initial trials count > ZERO", actual: "Initial trials count = ZERO" };
                    throw exception;
                }
                else {
                    if (trialsCountRegex.exec(botReply.text)) { // if the message contains trials count don't assert literally
                        testData.trialsCount = parseInt(botReply.text.split(" ")[1]); // split on space => the second record will be trials' count
                        expect(testData.trialsCount, "Initial trials count is ZERO").to.be.greaterThan(0);
                        if (testData.prevTrialsCount > 0 && testData.prevTrialsCount > testData.trialsCount) {
                            testData.decreasedAtLeastOnce = true;
                        }
                        testData.prevTrialsCount = testData.trialsCount;
                    }
                    else {
                        if (this.checkIfConversationEnded(testData)) {
                            testData.testEnded = true;
                            expect(testData.decreasedAtLeastOnce, "Trials count didn't decrease").to.be.true;
                        }
                        expect(botReply.text, "The bot replied with empty text").to.not.be.empty;
                    }
                }
            }
            if (botReply.hasOwnProperty("attachments")) {
                try {
                    this.assertThatCardsFieldsAreNotEmpty(botReply.attachments);
                    if (testData.testEnded) {
                        expect(botReply.attachments[0].content.body.length, "Final trials count is ZERO").to.be.greaterThan(0);
                    }
                }
                catch (err) {
                    var exception = new Error(err.message);
                    exception.details = { message: err.message, expected: err.expected, actual: err.actual, diff: diff(err.expected, err.actual) };
                    throw exception;
                }
            }
        }
        return true;
    }
}

module.exports = DynamicTest;

