var _ = require("underscore");
var applicationinsights = require("applicationinsights");

var telemetry = process.env["ApplicationInsightsInstrumentationKey"] ? new applicationinsights.TelemetryClient(process.env["ApplicationInsightsInstrumentationKey"]) : null;
var config = require("./config.json"); // was used below without being imported

var utils = require("./utils");
const sleep = require("util").promisify(setTimeout);

var Test = require("./test");
var Result = require("./result");
var ResultsManager = require("./resultsManager");

class Suite {

    constructor(context, runId, suiteData) {
        this.results = [];
        this.context = context;
        this.runId = runId;
        this.suiteData = suiteData;
    }

     async runTest(testData) {
        try {
            const result = await testData.createTest().perform(this.context, testData);
            return result;
        }
        catch (err) {
            return new Result(false, err.message, 400);
        }
    }

    summarizeTestsResults() {
        const success = _.every(this.results, (result) => result && result.success);
        const messages = _.pluck(this.results, "message");
        if (success) {
            if (telemetry) {
                telemetry.trackEvent({name: "TestSuiteSucceeded", properties: {suite: this.suiteData.name, details: messages}});
            }
            ResultsManager.updateSuiteResults(this.runId, messages, "", "success");
        }
        else {
            if (telemetry) {
                telemetry.trackEvent({name: "TestSuiteFailed", properties: {suite: this.suiteData.name, details: messages}});
            }
            ResultsManager.updateSuiteResults(this.runId, messages, "", "failure");
        }
    }

    async run() {
        this.context.log("Suite.run started");
        this.context.log("suiteData: " + utils.stringify(this.suiteData));
        // We will divide the tests into batches. Batch size is determined by env var "BatchSize" (default 3).
        const batchSize = parseInt(process.env["BatchSize"]) ? parseInt(process.env["BatchSize"]) : config.defaults.defaultBatchSize;
        let testPromises = [];
        try {
            for (let i=0; i<this.suiteData.testData.length; i++) {
                const currTestData = this.suiteData.testData[i];
                testPromises.push(this.runTest(currTestData));
                if ((i+1)%batchSize === 0) { // If end of batch is reached
                    await Promise.all(testPromises); // Wait for batch run to end
                }
                else { // Sleep for 1 second between tests of the same batch (and avoid sleeping between batches).
                    await sleep(1000);
                }
            }
            this.results = await Promise.all(testPromises); // Wait for last batch (can be smaller than batchSize).
        }
        catch (err) {
            throw new Error("Error occurred while executing a test: " + err);
        }
        this.summarizeTestsResults();
    }
}

module.exports = Suite;
