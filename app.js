
var Context = require("./context.js");
var TestData = require("./testData.js");
var Test = require("./test");
var SuiteData = require("./suiteData.js");
var Suite = require("./suite");

var restify = require("restify");

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

server.listen(process.env.PORT || 3000, function () {
    console.log("%s listening at %s", server.name, server.url);
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
        var suiteData = await SuiteData.fromRequest(request);
        Suite.run(context, suiteData);
    }
    catch (err) {
        context.failure(400, err.message);
    }
}
