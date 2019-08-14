var _ = require("underscore");
var applicationinsights = require("applicationinsights");

var telemetry = process.env["ApplicationInsightsInstrumentationKey"] ? new applicationinsights.TelemetryClient(process.env["ApplicationInsightsInstrumentationKey"]) : null;

var utils = require("./utils");

var Test = require("./test");
var Result = require("./result");

class Suite {
    static async run(context, suiteData) {
        context.log("Suite.run started");
        context.log("suiteData: " + utils.stringify(suiteData));

        var results = [];
        var currTestIndex = 0; // Used as a global variable for runTest function.

        var runTest = async function(testData, callback) {
            try {
                var result = await Test.perform(context, testData);
                results[currTestIndex] = result;
            }
            catch (err) {
                results[currTestIndex] = new Result(false, err.message, 400);
            }
            currTestIndex++;
        };

        var end = function(err) {
            var success = _.every(results, (result) => result && result.success);
            var messages = _.pluck(results, "message");
            if (success) {
                if (telemetry) {
                    telemetry.trackEvent({name: "TestSuiteSucceeded", properties: {suite: suiteData.name, details: messages}});
                }
                context.success(messages);
            }
            else {
                if (telemetry) {
                    telemetry.trackEvent({name: "TestSuiteFailed", properties: {suite: suiteData.name, details: messages}});
                }
                context.failure(500, messages);
            }
        };
        try {
            for (var batch of suiteData.testData) {
                await utils.delayedForEachOf(batch, runTest, 1);
            }
        }
        catch {
            throw new Error("Error occurred while executing a test");
        }
        end();
    }
}

module.exports = Suite;
