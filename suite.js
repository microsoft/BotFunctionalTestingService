var _ = require("underscore");
var async = require("async");
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

        var runTest = async function(testData, index, callback) {
            try {
                var result = await Test.perform(context, testData);
                results[index] = result;
            }
            catch (err) {
                results[index] = new Result(false, err.message, 400);
            }
            // Whether the test failed or succeeded, we just store the result and invoke the callback with no error
            callback();
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

        async.forEachOf(suiteData.testData, runTest, end);
    }
}

module.exports = Suite;
