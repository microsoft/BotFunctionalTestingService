class Context {
    
    constructor(req, response) {
        this.request = req;
        this.response = response;
        this.res = null;
    }

    log(msg) {
        console.log(msg);
    }

    done() {
        this.response.setHeader("content-type", this.res.contentType);
        this.response.send(this.res.status, this.res.reason)
    }

    success(message) {
        this.log("success: " + message);
        this.res = {
            status: 200,
            reason: message,
            contentType: "application/json"
        };
        this.done();
    }

    failure(code, reason) {
        this.log("failure: " + JSON.stringify(reason));
        this.res = {
            status: code,
            reason: reason,
            contentType: "application/json"
        };
        this.done();
    }
}

module.exports = Context;
