const logger = require("./logger.js");

class Context {
    
    constructor(req, response) {
        this.request = req;
        this.response = response;
    }

    done(status, body) {
        this.response.setHeader("content-type", "application/json");
        this.response.status(status).send(body);
    }

    success({ message, conversationId }) {
        logger.log("success: " + message);
        this.done(200, this.request.query.includeConversationId ? { message, conversationId } : message);
    }

    failure(code, reason) {
        logger.log("failure: " + JSON.stringify(reason));
        this.done(code, reason);
    }
}

module.exports = Context;
