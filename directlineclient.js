var fetch = require("node-fetch");

var utils = require("./utils.js");

// config items
var pollInterval = 300;

var directLineStartConversationUrl = "https://directline.botframework.com/v3/directline/conversations";
var directLineConversationUrlTemplate = "https://directline.botframework.com/v3/directline/conversations/{id}/activities";

DirectLineClient = function () {
    this.context = null;
    this.headers = {};
    this.watermark = {};
}

DirectLineClient.prototype.init = function (context, secret) {
    context.log("init started");
    var self = this;
    this.context = context;
    var headers = {
        Authorization: "Bearer " + secret,
    };

    headers['Content-Type'] = 'application/json'
    var startConversationOptions = {
        method: "POST",
        headers: headers,
    };

    var promise = fetch(directLineStartConversationUrl, startConversationOptions).then(async response => {
        response = await response.json()
        context.log("init response: " + utils.stringify(response));
        self.watermark[response.conversationId] = null;
        self.headers[response.conversationId] = headers;
        return response;
    });
    return promise;
}

DirectLineClient.prototype.sendMessage = function (conversationId, message) {
    this.context.log("sendMessage started");
    this.context.log("conversationId: " + conversationId);
    this.context.log("message: " + utils.stringify(message));
    var self = this;
    if (!conversationId) {
        throw new Error("DirectLineClient got invalid conversationId.");
    }

    var promise;
    if (isValidMessage(message)) {
        var postMessageOptions = {
            method: "POST",
            headers: self.headers[conversationId],
            body: JSON.stringify(message),
        };
        let uri = getConversationUrl(conversationId);
        promise = fetch(uri, postMessageOptions)
            .then(async function (response) {
                self.context.log("sendMessage response: " + utils.stringify(response));
                return response.json();
            });
    }
    else {
        self.context.log("sendMessage: message is invalid, not sending.");
        promise = Promise.resolve(null);
    }

    return promise;
}

DirectLineClient.prototype.pollMessages = function (conversationId, nMessages, bUserMessageIncluded, maxTimeout, customPollInterval) {
    this.context.log("pollMessages started");
    this.context.log("conversationId: " + conversationId);
    this.context.log("nMessages: " + nMessages);
    this.context.log("bUserMessageIncluded: " + bUserMessageIncluded);
    this.context.log("maxTimeout: " + maxTimeout);
    var self = this;
    if (!conversationId) {
        throw new Error("DirectLineClient got invalid conversationId.");
    }

    var getMessagesOptions = {
        method: "GET",
        headers: self.headers[conversationId],
    };

    var uri = getConversationUrl(conversationId) + (this.watermark[conversationId] ? "?watermark=" + this.watermark[conversationId] : "")
    var retries = 0;
    pollInterval = customPollInterval || pollInterval
    var maxRetries = (maxTimeout - 1) / pollInterval + 1;
    var messages;
    var nExpectedActivities = bUserMessageIncluded ? nMessages + 1 : nMessages;
    var promise = new Promise(function (resolve, reject) {
        var polling = async function () {
            if (retries < maxRetries) {
                try {
                    let response = await fetch(uri, getMessagesOptions);
                    response = await response.json();
                    messages = response.activities;
                    self.context.log(`Got ${messages.length} total activities (including user's response)`);
                    if (messages.length < nExpectedActivities) {
                        self.context.log(`We have less than expected ${nExpectedActivities} activities - retry number ${retries + 1}...`);
                        retries++;
                        setTimeout(polling, pollInterval);
                    }
                    else {
                        self.watermark[conversationId] = response.watermark;
                        self.context.log(`pollMessages messages: ${utils.stringify(messages)}`)
                        resolve(messages);
                    }

                } catch (err) {
                    self.context.log("failed to get actitvities, retrying...");
                    retries++;
                    setTimeout(polling, pollInterval);
                }

            } else {
                self.context.log(`pollMessages messages: ${utils.stringify(messages)}`)
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

function getConversationUrl(conversationId) {
    return directLineConversationUrlTemplate.replace("{id}", conversationId);
}

module.exports = new DirectLineClient();
