const logger = require("./logger.js");

class Context {
    
    constructor(req, response) {
        this.request = req;
        this.response = response;
        this.res = null;
    }

    done() {
        this.response.setHeader("content-type", "application/json");
        this.response.send(this.res.status, this.res.conversationId ? {
            message: this.res.reason,
            conversationId: this.res.conversationId
        } : this.res.reason);
    }

    success(message, conversationId) {
        logger.log("success: " + message);
        this.res = {
            status: 200,
            reason: message,
            conversationId
        };
        this.done();
    }

    failure(code, reason) {
        logger.log("failure: " + JSON.stringify(reason));
        this.res = {
            status: code,
            reason: reason,
        };
        this.done();
    }
}

module.exports = Context;
