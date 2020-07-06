var rp = require("request-promise");

var utils = require("./utils.js");

// config items
var pollInterval = 500;

var directLineStartConversationUrl = "https://directline.botframework.com/v3/directline/conversations";
var directLineConversationUrlTemplate = "https://directline.botframework.com/v3/directline/conversations/{id}/activities";

DirectLineClient = function() {
    this.context = null;
    this.headers = {};
    this.watermark = {};
}

DirectLineClient.prototype.init = function(context, secret) {
    context.log("init started");
    var self = this;
    this.context = context;
    var headers = {
        Authorization: "Bearer " + secret
    };
    var startConversationOptions = {
        method: "POST",
        uri: directLineStartConversationUrl,
        headers: headers,
        json: true
    };
    var promise = rp(startConversationOptions)
        .then(function(response) {
            context.log("init response: " + utils.stringify(response));
            self.watermark[response.conversationId] = null;
            self.headers[response.conversationId] = headers;
            return response;
        });
    return promise;
}

DirectLineClient.prototype.sendMessage = function(conversationId, message) {
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
            uri: getConversationUrl(conversationId),
            headers: self.headers[conversationId],
            body: message,
            json: true
        };

        promise = rp(postMessageOptions)
            .then(function(response) {
                self.context.log("sendMessage response: " + utils.stringify(response));
                return response;
            });
    }
    else {
        self.context.log("sendMessage: message is invalid, not sending.");
        promise = Promise.resolve(null);
    }

    return promise;
}

DirectLineClient.prototype.pollMessages = function(conversationId, nMessages, bUserMessageIncluded, maxTimeout) {
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
        uri: getConversationUrl(conversationId) + (this.watermark[conversationId] ? "?watermark=" + this.watermark[conversationId] : ""),
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
                rp(getMessagesOptions)
                    .then(function(response) {
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
                    })
                    .catch(function(err) {
                        self.context.log("failed to get actitvities, retrying...");
                        retries++;
                        setTimeout(polling, pollInterval);
                    });
            }
            else {
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
