var _ = require("underscore");

var HTTP = require("./http");
var TestData = require("./testData");
var DynamicTestData = require("./dynamicTestData");

const DynamicTestTypeName = "DynamicTestData";
class SuiteData {
    constructor(obj, query) {

        this.name = (query && query.name) || (obj && obj.name);

        if (!this.name) {
            throw new Error("A suite 'name' parameter should be included on the query string or in the request body.");
        }

        var tests = obj && obj.tests;

        if(!obj){
            tests = [query]
        }
        else if (!tests || !_.isArray(tests)) {
            throw new Error("A suite must contain a 'tests' array.");
        }
        else if (tests.length == 0) {
            throw new Error("The suite 'tests' array must not be empty.");
        }
        this.tests = tests;
        this.defaults = _.pick(_.extend(obj, query), TestData.inheritedProperties());
    }
    async init() {
        this.testData = await createTestData(this.tests, this.defaults);
    }

    static async fromRequest(request) {
        var suiteData = null;
        switch (request.method) {
            case "GET":
                suiteData = await this.getSuiteData(request.query);
                break;
            case "POST":
                suiteData = new SuiteData(request.body, request.query);
                break;
        }
        if (suiteData) {
            await suiteData.init();
        }
        return suiteData;
    }

    static async getSuiteData(query) {
        var suiteURL = query.url;
        if (suiteURL) {
            var response = await HTTP.getJSON(suiteURL);
            return new SuiteData(response, query);
        }else if(query.testType == DynamicTestTypeName){
            return new SuiteData(null, query);
        }
        else {
            throw new Error("A 'url' parameter should be included on the query string.");
        }
    }

}


async function createTestData(tests, defaults) {
    async function createData(test, index) {
        return new Promise(async function(resolve, reject) {
            try {
                if(test.testType == DynamicTestTypeName){
                    resolve(await DynamicTestData.fromObject(test, defaults));
                }else{
                    resolve(await TestData.fromObject(test, defaults));
                }
                
            }
            catch (err) {
                reject(new Error(`tests[${index}]: ${err.message}`));
            }
        });
    }
    return Promise.all(tests.map(createData));
}

module.exports = SuiteData;
