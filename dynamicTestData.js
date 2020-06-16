var fs = require('fs');
var _ = require("underscore");

var HTTP = require("./http");
var DynamicTest = require("./dynamicTest.js");
var Transcript = require("./transcript");

var config = require("./config.json");

class DynamicTestData {

    constructor(query) {
        //super(query);
        this.name = (query && query.name) || (query && query.url.split('/').pop());
        this.version = (query && query.version) 
        this.timeout = (query && query.timeout) || config.defaults.timeoutMilliseconds;
        this.bot = (query && query.bot) || process.env["DefaultBot"];
        this.trigger = (query && query.trigger) || "find clinical trials";
        this.condition = (query && query.condition) || "lung cancer";
        this.maxSteps = 20;
        this.trialsCount = -1;
        this.prevTrialsCount = -1;
        this.decreasedAtLeastOnce = false;
        this.testEnded = false;

        if (!this.bot) {
            throw new Error("Configuration error: No bot name was given as a query parameter nor as a test property and no DefaultBot in application settings.");
        }
        if (!this.secret) {
            throw new Error(`Configuration error: BotSecret is missing for ${this.bot}.`);
        }
        this.userId = (query && (query.userId || query.userid));
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
        return new DynamicTest();
    }

    async fromRequest(request) {
        var testData = null;
        switch (request.method) {
            case "GET":
                testData = await this.getTestData(request.query);
                break;
            case "POST":
                testData = new DynamicTestData(request.body, request.query);
                break;
        }
        return testData;
    }

    async getTestData(query) {
        return new DynamicTestData({}, query);
    }

    static inheritedProperties() {
        return ["version", "timeout", "bot", "userId"];
    }

    static async fromObject(query, defaults) {
        var testData = new DynamicTestData(query);
        var testDataProto = Object.getPrototypeOf(testData);
        testData = _.extend(_.pick(defaults, this.inheritedProperties()), testData);
        Object.setPrototypeOf(testData, testDataProto);
        return testData;
    }

}

module.exports = DynamicTestData;
