var _ = require("underscore");

var HTTP = require("./http");

var Transcript = require("./transcript");

var config = require("./config.json");
const Test = require("./test");

class TestData {

    constructor(obj, query) {
        this.name = (query && query.name) || (obj && obj.name) || (query && query.url.split('/').pop());
        this.version = (query && query.version) || (obj && obj.version);
        this.timeout = (query && query.timeout) || (obj && obj.timeout) || config.defaults.timeoutMilliseconds;
        this.bot = (query && query.bot) || (obj && obj.bot) || process.env["DefaultBot"];
        this.userId = query.userId || "test-user-";
        
        if (!this.bot) {
            throw new Error("Configuration error: No bot name was given as a query parameter nor as a test property and no DefaultBot in application settings.");
        }
        if (!this.secret) {
            throw new Error(`Configuration error: BotSecret is missing for ${this.bot}.`);
        }
        this.userId = (query && (query.userId || query.userid)) || (obj && (obj.userId || obj.userid));
        this.messages = (obj && obj.messages) || Transcript.getMessages(obj);
        if (!(this.messages && Array.isArray(this.messages) && this.messages.length > 0)) {
            throw new Error("A test must contain a non-empty 'messages' array or consist of a bot conversation transcript.")
        }
    }

    get secret() {
        var extractedSecret = null;
        try {
            extractedSecret = JSON.parse(process.env['SECRETS'])[this.bot];
        }
        catch {
            throw new Error("Invalid format of bot secrets JSON");
        }
        return extractedSecret;
    }


    createTest(){
        return new Test();
    }

    async fromRequest(request) {
        var testData = null;
        switch (request.method) {
            case "GET":
                testData = await this.getTestData(request.query);
                break;
            case "POST":
                testData = new TestData(request.body, request.query);
                break;
        }
        return testData;
    }

    async getTestData(query) {
        var testURL = query.url;
        if (testURL) {
            var response = await HTTP.getJSON(testURL);
            return new TestData(response, query);
        }
        else {
            throw new Error("A 'url' parameter should be included on the query string.");
        }
    }

    static inheritedProperties() {
        return ["version", "timeout", "bot", "userId"];
    }

    static async fromObject(obj, defaults) {
        var testData = null;
        if (obj.hasOwnProperty("url") && obj.url) {
            var response = await HTTP.getJSON(obj.url);
            testData = new TestData(response, obj);
        }
        else {
            testData = new TestData(obj, {});
        }
        var testDataProto = Object.getPrototypeOf(testData);
        testData = _.extend(_.pick(defaults, this.inheritedProperties()), testData);
        Object.setPrototypeOf(testData, testDataProto);
        return testData;
    }

}

module.exports = TestData;
