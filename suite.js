var _ = require("underscore");

var utils = require("./utils");
var config = require("./config.json");
const sleep = require("util").promisify(setTimeout);

var Test = require("./test");
var Result = require("./result");
var ResultsManager = require("./resultsManager");
const logger = require("./logger");

class Suite {

    constructor(context, runId, suiteData) {
        this.results = [];
        this.context = context;
        this.runId = runId;
        this.suiteData = suiteData;
    }

     async runTest(testData) {
        try {
            let tolerance = parseInt(process.env["failureTolerance"]) ? parseInt(process.env["failureTolerance"]) : config.defaults.failureTolerance;
            let result;
            while (!(result && result.success === true) && tolerance > 0) {
                result = await Test.perform(this.context, testData);
                tolerance--;
            }
            return result;
        }
        catch (err) {
            return new Result({ success: false, message: err.message, code: 400 });
        }
    }

    summarizeTestsResults() {
        const success = _.every(this.results, (result) => result && result.success);
        if (success) {
            logger.event("TestSuiteSucceeded", { suite: this.suiteData.name, details: this.results });
            ResultsManager.updateSuiteResults(this.runId, this.results, "", "success");
        }
        else {
            logger.event("TestSuiteFailed", { suite: this.suiteData.name, details: this.results });
            ResultsManager.updateSuiteResults(this.runId, this.results, "", "failure");
        }
    }

    async run() {
        logger.log("Suite.run started");
        logger.log("suiteData: " + utils.stringify(this.suiteData));
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
