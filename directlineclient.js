var rp = require("request-promise");

var utils = require("./utils.js");
const logger = require("./logger");
const config = require("./config.json");
const Test = require("./test");
const Result = require("./result");

// config items
var pollInterval = 300;
var initInterval = 500;

var directLineStartConversationUrl = `https://{directlineDomain}/v3/directline/conversations`;
var directLineConversationUrlTemplate = `https://{directlineDomain}/v3/directline/conversations/{id}/activities`;

DirectLineClient = function() {
    this.context = null;
    this.headers = {};
    this.watermark = {};
}

DirectLineClient.prototype.init = async function(context, testData) {
    logger.log("DirectLine - init started");
    var self = this;
    this.context = context;
    var headers = {
        Authorization: "Bearer " + testData.secret
    };
    var startConversationOptions = {
        method: "POST",
        uri: getDirectLineStartConversationUrl(testData.customDirectlineDomain),
        headers: headers,
        json: true
    };
    //new version:
    logger.log(`Init conversation request: ${JSON.stringify(startConversationOptions)}`);
    let result = false;
    let message;
    let promise;
    let tolerance = parseInt(process.env.failureTolerance) ? parseInt(process.env.failureTolerance) : config.defaults.failureTolerance;
    let iterNum = tolerance;
    while (!result && (tolerance > 0)) {
        promise = await rp(startConversationOptions)
            .then(function(response) {
                message = utils.stringify(response)
                logger.log("init response: " + message);
                self.watermark[response.conversationId] = null;
                self.headers[response.conversationId] = headers;
                result = true;
                return response;})
            .catch(async ()=> {logger.log("failed to initialize, retrying...");
                const sleep= time => {return new Promise(resolve => {setTimeout(resolve, time)})};
                await sleep(initInterval).then(function (response){return;})});
        tolerance--;
        if (result === true) {
            break;
        }
        if (tolerance === 0){
            logger.log("failed initializing %d times",iterNum );
        }
    }
    return promise;
}

DirectLineClient.prototype.sendMessage = function(conversationId, message, customDirectlineDomain) {
    logger.log("sendMessage started");
    logger.log("conversationId: " + conversationId);
    logger.log("message: " + utils.stringify(message));
    var self = this;
    if (!conversationId) {
        throw new Error("DirectLineClient got invalid conversationId.");
    }

    var promise;
    if (isValidMessage(message)) {
        var postMessageOptions = {
            method: "POST",
            uri: getConversationUrl(conversationId, customDirectlineDomain),
            headers: self.headers[conversationId],
            body: message,
            json: true
        };

        logger.log(`Send message request: ${JSON.stringify(postMessageOptions)}`);
        promise = rp(postMessageOptions)
            .then(function(response) {
                logger.log("sendMessage response: " + utils.stringify(response));
                return response;
            });
    }
    else {
        logger.log("sendMessage: message is invalid, not sending.");
        promise = Promise.resolve(null);
    }

    return promise;
}

DirectLineClient.prototype.pollMessages = function(conversationId, nMessages, bUserMessageIncluded, maxTimeout, customDirectlineDomain) {
    logger.log("pollMessages started");
    logger.log("conversationId: " + conversationId);
    logger.log("nMessages: " + nMessages);
    logger.log("bUserMessageIncluded: " + bUserMessageIncluded);
    logger.log("maxTimeout: " + maxTimeout);
    var self = this;
    if (!conversationId) {
        throw new Error("DirectLineClient got invalid conversationId.");
    }

    var getMessagesOptions = {
        method: "GET",
        uri: getConversationUrl(conversationId, customDirectlineDomain) + (this.watermark[conversationId] ? "?watermark=" + this.watermark[conversationId] : ""),
        headers: self.headers[conversationId],
        json: true
    };

    var retries = 0;
    var maxRetries = (maxTimeout - 1) / pollInterval + 1;
    var messages;
    var nExpectedActivities = bUserMessageIncluded ? nMessages + 1 : nMessages;
    var promise = new Promise(function(resolve, reject) {
        var polling = function() {
            if (retries < maxRetries) {
                logger.log(`Poll messages request: ${JSON.stringify(getMessagesOptions)}`);
                rp(getMessagesOptions)
                    .then(function(response) {
                        messages = response.activities;
                        logger.log(`Got ${messages.length} total activities (including user's response)`);
                        if (messages.length < nExpectedActivities) {
                            logger.log(`We have less than expected ${nExpectedActivities} activities - retry number ${retries + 1}...`);
                            retries++;
                            setTimeout(polling, pollInterval);
                        }
                        else {
                            self.watermark[conversationId] = response.watermark;
                            logger.log(`pollMessages messages: ${utils.stringify(messages)}`)
                            resolve(messages);
                        }
                    })
                    .catch(function(err) {
                        logger.log("failed to get actitvities, retrying...");
                        retries++;
                        setTimeout(polling, pollInterval);
                    });
            }
            else {
                logger.log(`pollMessages messages: ${utils.stringify(messages)}`)
                reject(new Error(`Could not obtain ${nMessages} responses`));
            }
        }
        setTimeout(polling, pollInterval);
    });
    return promise;
}

function isValidMessage(message) {
    return message && message.hasOwnProperty("type");
}

function getConversationUrl(conversationId, customDirectlineDomain) {
    return directLineConversationUrlTemplate.replace("{directlineDomain}", customDirectlineDomain || process.env["directlineDomain"] || "directline.botframework.com" ).replace("{id}", conversationId);
}

function getDirectLineStartConversationUrl(customDirectlineDomain) {
    return directLineStartConversationUrl.replace("{directlineDomain}", customDirectlineDomain || process.env["directlineDomain"] || "directline.botframework.com" );
}

module.exports = new DirectLineClient();
