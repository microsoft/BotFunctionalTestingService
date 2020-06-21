var fs = require('fs');
var _ = require("underscore");

var HTTP = require("./http");
var DynamicTest = require("./dynamicTest.js");
var Transcript = require("./transcript");

var config = require("./config.json");

class DynamicTestData {

    constructor(test,query) {
        //super(query);
        this.name = (test && test.name) || (query && query.name) || (query && query.url.split('/').pop());
        this.version = (query && query.version) 
        this.timeout = (query && query.timeout) || config.defaults.timeoutMilliseconds;
        this.bot = (query && query.bot) || process.env["DefaultBot"];
        this.scenario = (test && test.scenario)  || (query && query.trigger) || "hi";
        this.defaultSelectedChoice = (test && test.defaultSelectedChoice)  || (query && query.defaultSelectedChoice) || 0;
        this.conversationEndRegex = (test && test.conversationEndRegex)  || (query && query.conversationEndRegex)
        this.dynamicQA = (test && test.dynamicQA)
        this.tests = (test && test.tests)
        this.maxSteps = 35;
        this.trialsCount = -1;
        this.prevTrialsCount = -1;
        this.testEnded = false;

        if (!this.bot) {
            throw new Error("Configuration error: No bot name was given as a query parameter nor as a test property and no DefaultBot in application settings.");
        }
        if (!this.secret) {
            throw new Error(`Configuration error: BotSecret is missing for ${this.bot}.`);
        }
        if (!this.conversationEndRegex) {
            throw new Error(`Configuration error: conversationEndRegex is missing for ${this.bot}.`);
        }
        if (!this.tests) {
            throw new Error(`Configuration error: tests is missing for ${this.bot}.`);
        }
        this.userId = (query && (query.userId || query.userid));

        this.conversationEndRegex = this.regexFromString(this.conversationEndRegex)

        for (let i = 0; i < this.dynamicQA.length; i++) {   
            this.dynamicQA[i].regex = this.regexFromString(this.dynamicQA[i].regex)
        }

        for (let i = 0; i < this.tests.length; i++) {
            this.tests[i].regex = this.regexFromString(this.tests[i].regex)
        }

    }

    regexFromString(regStr){
        let reg = regStr.split('/')
        return new RegExp(reg[0],reg[1] || "")
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
        var suiteURL = query.url;
        if (suiteURL) {
            var response = await HTTP.getJSON(suiteURL);
            return new SuiteData(response, query);
        }
        else {
            throw new Error("A 'url' parameter should be included on the query string.");
        }
    }

    static inheritedProperties() {
        return ["version", "timeout", "bot", "userId"];
    }

    static async fromObject(test, defaults) {
        var testData = new DynamicTestData(test,defaults);
        var testDataProto = Object.getPrototypeOf(testData);
        testData = _.extend(_.pick(defaults, this.inheritedProperties()), testData);
        Object.setPrototypeOf(testData, testDataProto);
        return testData;
    }


    

}

module.exports = DynamicTestData;
