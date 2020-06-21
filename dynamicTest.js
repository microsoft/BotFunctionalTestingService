var Test = require("./test");
var _ = require("underscore");
var expect = require("chai").expect;
var diff = require("deep-object-diff").diff;
var directline = require("./directlineclient");
var utils = require("./utils.js");
const { select } = require("underscore");
const { validateKeyChars } = require("applicationinsights/out/Library/Tracestate");

const regex = {
    ageQuestions: new RegExp(/age|old/, 'i'),
    genderQuestions: new RegExp(/gender|sex/, 'i'),
    searchQuestions: new RegExp(/search/, 'i'),
    noTrials: new RegExp(/(found 0|no) relevant trials/, 'i'),
    matchingTrials: new RegExp(/(matching clinical trials)|(relevant trials)/, 'i'),
    countryQuestions: new RegExp(/country/, 'i'),
    stateQuestions: new RegExp(/state/, 'i'),
    numericQuestions: new RegExp(/^(what is the patient's).*\?/, 'i'),
    conditionQuestions: new RegExp(/^(what .* condition).*\?/, 'i')
};


const ResponseType = {
    Message: "Message",
    Pull: "Pull",
    Error: "Error"
}

const TestType = {
    GreaterThan: "GreaterThan",
    LowerThen: "LowerThen",
    Equals: "Equals",
    Match: "Match"
}

class DynamicTest extends Test {

    constructor() { super(); }

    checkIfConversationEnded(testData) {
        return testData.lastMessageFromBot && testData.lastMessageFromBot.hasOwnProperty("text") &&
            testData.lastMessageFromBot.text.match(testData.conversationEndRegex)
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


    async testStep(context, conversationId, userMessage, expectedReplies, testData) {
        let pullAnotherMessage = false;
        let messagesToPull = 1;
        if (testData.lastMessageFromBot == undefined) {
            userMessage.text = "begin " + testData.scenario;
        } else {
            let foundMatch = false;
            testData.dynamicQA.forEach(dqa => {
                if (testData.lastMessageFromBot.text.match(dqa.regex)) {
                    let response = dqa.response;
                    switch (response.type) {
                        case ResponseType.Message:
                            userMessage.text = response.value;
                            foundMatch = true;
                            return;
                        case ResponseType.Pull:
                            messagesToPull = parseInt(response.value);
                            pullAnotherMessage = true;
                            foundMatch = true;
                            return;
                        case ResponseType.Error:
                            throw response.value;
                        default:
                            throw 'wrong response type: ' + response.type;
                    }
                }
            })

            if (!foundMatch) {
                if (this.isChoicesQuestion(testData.lastMessageFromBot)) {
                    userMessage.text = this.getFirstChoice(testData.lastMessageFromBot); // first choice
                } else if (this.checkIfConversationEnded(testData)) {
                    //do nothing
                } else {
                    context.log("error - unrecognized message: " + testData.lastMessageFromBot);
                    throw "error - unrecognized message: " + testData.lastMessageFromBot;

                }
            }
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

            if (botReply.hasOwnProperty("text")) {
                testData.tests.filter(t => t.target == "Text").forEach(test => {
                    if (botReply.text.match(test.regex)) {
                        if (test.value.startsWith("$")) {
                            test.value = testData.vars[test.value]
                        }
                        if (test.save) {
                            testData.vars[test.save] = test.value
                        }

                        switch (test.type) {
                            case TestType.Equals:
                                expect(botReply.text, test.error).to.equal(test.value)
                                break;
                            case TestType.GreaterThan:
                                expect(botReply.text, test.error).to.be.gt(test.value)
                                break;
                            case TestType.LowerThen:
                                expect(botReply.text, test.error).to.be.lt(test.value)
                                break;
                            case TestType.Match:
                                throw test.error
                                break;
                            default:
                                throw "unknown test type " + test.type;
                        }
                    }
                });
            }


            //TODO - support dynamic card tests with json path
            if (botReply.hasOwnProperty("attachments")) {
                botReply.attachments.forEach(a => expect(a, "empty attachment").to.not.be.empty)
                botReply.attachments.forEach(attachment => {
                    let body = attachment.content.body;
                    if (attachment.content.body) {
                        attachment.content.body.forEach(body => {
                            expect(body.items.length, "empty body").to.be.gt(0)
                            body.items.forEach(item => {
                                if (item.type == "TextBlock") {
                                    expect(item.text, "null TextBlock").to.not.be.null
                                    expect(item.text, "undefined TextBlock").to.not.be.undefined
                                    expect(item.text, "empty TextBlock").to.not.be.empty
                                }
                            })
                        });

                    } else if (attachment.content.buttons) {
                        expect(attachment.content.buttons.length, "empty buttons").to.be.gt(0)
                        attachment.content.buttons.forEach(btn => {
                            expect(btn.title, "null title").to.not.be.null
                            expect(btn.title, "undefined title").to.not.be.undefined
                            expect(btn.title, "empty title").to.not.be.empty

                            expect(btn.value, "null value").to.not.be.null
                            expect(btn.value, "undefined value").to.not.be.undefined
                            expect(btn.value, "empty value").to.not.be.empty
                        })


                    } else {
                        throw "Empty attachment"
                    }
                })
            }

        }

        return true;
    }
}

module.exports = DynamicTest;

