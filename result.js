class Result {
    constructor({ success, message, code, conversationId }) {
        this.success = success;
        this.message = message;
        this.code = code;
        this.conversationId = conversationId;
    }
}

module.exports = Result;