var _ = require("underscore");
var Transcript = require("./transcript");

var config = require("./config.json");
const fs = require("fs");
const path = require('path');
const exists = require('util').promisify(fs.exists);

const readFile = require('util').promisify(fs.readFile);

const retry_amount = 3;
const sleep = require('util').promisify(setTimeout);
const axios = require('axios');

const executeWithRetries = async (func, ...args) => {
    for (let retry_count = 0; retry_count < retry_amount; retry_count++) {
        if (retry_count > 0) {
            await sleep(retry_count*1000);
        }
        try {
            const content = await func(...args);
            return content;
        }
        catch (err) {
            if (retry_count === retry_amount - 1) {
                console.error(err);
            }
        }
    }
}


class TestData {

    constructor(obj, query) {
        this.name = (query && query.name) || (obj && obj.name) || (query?.url?.split('/').pop()) || (query?.path?.split('/').pop());
        this.version = (query && query.version) || (obj && obj.version);
        this.timeout = (query && query.timeout) || (obj && obj.timeout) || config.defaults.timeoutMilliseconds;
        this.bot = (query && query.bot) || (obj && obj.bot) || process.env["DefaultBot"];
        if (!this.bot) {
            throw new Error("Configuration error: No bot name was given as a query parameter nor as a test property and no DefaultBot in application settings.");
        }
        this.secret = query?.botSecret || obj?.botSecret || this.getSecretFromEnvVar();
        this.customDirectlineDomain = query?.customDirectlineDomain || obj?.customDirectlineDomain;
        if (!this.secret) {
            throw new Error(`Configuration error: BotSecret is missing for ${this.bot}.`);
        }
        this.userId = (query && (query.userId || query.userid)) || (obj && (obj.userId || obj.userid));
        this.messages = (obj && obj.messages) || Transcript.getMessages(obj);
        if (!(this.messages && Array.isArray(this.messages) && this.messages.length > 0)) {
            throw new Error("A test must contain a non-empty 'messages' array or consist of a bot conversation transcript.")
        }
    }

    getSecretFromEnvVar() {
        var extractedSecret = null;
        try {
            extractedSecret = JSON.parse(process.env['SECRETS'])[this.bot];
        }
        catch {
            throw new Error("Invalid format of bot secrets JSON");
        }
        return extractedSecret;
    }

    static inheritedProperties() {
        return ["version", "timeout", "bot", "userId", "botSecret"];
    }

    static async fromRequest(request) {
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

    static async getTestData(query) {
        var testURL = query.url;
        if (testURL) {
            const { data } = await axios.get(testURL); // CodeQL [SM04580] this is a closed api that is only accessible to an internal testing service, so the ssrf risk is mitigated
            return new TestData(data, query);
        } else if (query.path) {
            const fullTestPath = path.join(config.testsDir, query.path).normalize();
            if (!(await exists(fullTestPath)) || !fullTestPath.startsWith(config.testsDir)) {
                throw new Error("Test file invalid or not exists.");
            }
            const content = await executeWithRetries(readFile, fullTestPath);
            return new TestData(JSON.parse(content), query);
        } else {
            throw new Error("A 'url' or 'path' parameters should be included on the query string.");
        }
    }

    static async fromObject(obj, defaults) {
        var testData = null;
        if (obj.hasOwnProperty("url") && obj.url) {
            const { data } = await executeWithRetries(axios.get, obj.url);
            testData = new TestData(data, {...defaults, ...obj});
        } else if (obj.hasOwnProperty("path") && obj.path) {
            const content = await executeWithRetries(readFile, obj.path);
            testData = new TestData(JSON.parse(content), {...defaults, ...obj});
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


