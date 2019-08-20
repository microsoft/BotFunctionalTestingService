var Context = require("./context.js");
var TestData = require("./testData.js");
var Test = require("./test");
var SuiteData = require("./suiteData.js");
var Suite = require("./suite");
var ResultsManager = require("./resultsManager");

var restify = require("restify");

const deletionTimeConst = 3600; // 3600 seconds == 1 hour.

const server = restify.createServer({
    name: "BotFunctionalTestingService",
    version: "1.0.0"
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

server.get("/test", handleRunTest);
server.post("/test", handleRunTest);
server.get("/suite", handleRunSuite);
server.post("/suite", handleRunSuite);
server.get("/getResults/:runId", handleGetTestResults);

server.listen(process.env.PORT || 3000, function () {
    console.log("%s listening at %s", server.name, server.url);
    ResultsManager.init();
});

async function handleRunTest(request, response, next) {
    var context = new Context(request, response);
    context.log(`${server.name} processing a test ${request.method} request.`);

    try {
        var testData = await TestData.fromRequest(request);
        Test.run(context, testData);
    }
    catch (err) {
        context.failure(400, err.message);
    }
}

async function handleRunSuite(request, response, next) {
    var context = new Context(request, response);
    context.log(`${server.name} processing a suite ${request.method} request.`);
    try {
        var runId = ResultsManager.getFreshRunId();
        // Now send a response with status code 202 and location header based on runId, and start the tests.
        response.setHeader("content-type", "application/json");
        response.setHeader("Location", "http://" + request.headers.host + "/getResults/" + runId);
        response.send(202, "Tests are running.");
        var suiteData = await SuiteData.fromRequest(request); // SuiteData is a 2d-array. Each entry represents a batch. Each sub-entry includes a test.
        await Suite.run(context, suiteData, runId);
        setTimeout(() => {ResultsManager.deleteSuiteResult(runId)}, deletionTimeConst*1000); // Delete suite results data after a constant time after tests end..
    }
    catch (err) {
        response.setHeader("content-type", "application/json");
        response.send(400, err.message);
        setTimeout(() => {ResultsManager.deleteSuiteResult(runId)}, deletionTimeConst*1000);
    }
}

async function handleGetTestResults(request, response, next) {
    var runId = request.params.runId;
    var activeRunIds = ResultsManager.getActiveRunIds();
    if (!activeRunIds.has(runId)) {
        response.setHeader("content-type", "application/json");
        response.send(400, "RunId does not exist.");
        return;
    }
    // Else, runId exists.
    var results = ResultsManager.getSuiteResults(runId);
    if (!results) { // If results are not ready
        response.setHeader("content-type", "application/json");
        response.setHeader("Location", "http://" + request.headers.host + "/getResults/" + runId);
        response.setHeader("Retry-After", 10);
        response.send(202, "Tests are still running.");
    }
    else { // Results are ready
        response.setHeader("content-type", "application/json");
        if (results[1] === "success") {
            response.send(200, results[0]);
        }
        else if (results[1] === "failure") {
            response.send(500, results[0]);
        }

    }
}
