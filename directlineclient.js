const axios = require("axios");
var utils = require("./utils.js");
const logger = require("./logger");

// config items
var pollInterval = 300;

var directLineStartConversationUrl = `https://{directlineDomain}/v3/directline/conversations`;
var directLineConversationUrlTemplate = `https://{directlineDomain}/v3/directline/conversations/{id}/activities`;

DirectLineClient = function() {
    this.context = null;
    this.headers = {};
    this.watermark = {};
}

DirectLineClient.prototype.init = function(context, testData) {
    logger.log("DirectLine - init started");
    var self = this;
    this.context = context;
    var headers = {
        Authorization: "Bearer " + testData.secret
    };
    var startConversationOptions = {
        method: "POST",
        url: getDirectLineStartConversationUrl(testData.customDirectlineDomain),
        headers: headers
    };
    logger.log(`Init conversation request: ${JSON.stringify(startConversationOptions)}`);
    var promise = axios.request(startConversationOptions)
        .then(function({ data }) {
            logger.log("init response: " + utils.stringify(data));
            self.watermark[data.conversationId] = null;
            self.headers[data.conversationId] = headers;
            return data;
        });
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
            url: getConversationUrl(conversationId, customDirectlineDomain),
            headers: self.headers[conversationId],
            data: message
        };

        logger.log(`Send message request: ${JSON.stringify(postMessageOptions)}`);
        promise = axios.request(postMessageOptions)
            .then(function({ data }) {
                logger.log("sendMessage response: " + utils.stringify(data));
                return data;
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
        url: getConversationUrl(conversationId, customDirectlineDomain) + (this.watermark[conversationId] ? "?watermark=" + this.watermark[conversationId] : ""), // CodeQL [SM04580] false positive
        headers: self.headers[conversationId]
    };

    var retries = 0;
    var maxRetries = (maxTimeout - 1) / pollInterval + 1;
    var messages;
    var nExpectedActivities = bUserMessageIncluded ? nMessages + 1 : nMessages;
    var promise = new Promise(function(resolve, reject) {
        var polling = function() {
            if (retries < maxRetries) {
                logger.log(`Poll messages request: ${JSON.stringify(getMessagesOptions)}`); // CodeQL [SM04580] this is a closed api that is only accessible to an internal testing service, so the ssrf risk is mitigated
                axios.request(getMessagesOptions) // CodeQL [SM04580] this is a closed api that is only accessible to an internal testing service, so the ssrf risk is mitigated
                    .then(function({ data }) {
                        messages = data.activities;
                        logger.log(`Got ${messages.length} total activities (including user's response)`);
                        if (messages.length < nExpectedActivities) {
                            logger.log(`We have less than expected ${nExpectedActivities} activities - retry number ${retries + 1}...`);
                            retries++;
                            setTimeout(polling, pollInterval);
                        }
                        else {
                            self.watermark[conversationId] = data.watermark;
                            logger.log(`pollMessages messages: ${utils.stringify(messages)}`)
                            resolve(messages);
                        }
                    })
                    .catch(function(err) {
                        logger.log(`failed to get activities for on retry number ${retries + 1}. retrying...`);
                        logger.log(err);
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


