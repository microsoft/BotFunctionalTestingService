var _ = require("underscore");

var TestData = require("./testData");
var sanitize = require("sanitize-filename");
const fs = require("fs");
const path = require('path');
var config = require("./config.json");

const exists = require('util').promisify(fs.exists);
const listDir = require('util').promisify(fs.readdir);
const axios = require("axios");
class SuiteData {
    
    constructor(obj, query) {
        this.name = (query && query.name) || (obj && obj.name);
        if (!this.name) {
            throw new Error("A suite 'name' parameter should be included on the query string or in the request body.");
        }
        var tests = obj && obj.tests;
        if (!tests || !_.isArray(tests)) {
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
                let tests = request.body?.tests;
                let suiteDataObj = {...request.body};
                if (_.isString(tests)) {
                    const testsDir = path.join(config.testsDir, sanitize(tests));
                    if (await exists(testsDir)) {
                        suiteDataObj.tests = (await listDir(testsDir))
                            .filter(fileName => path.extname(fileName) === '.transcript')
                            .map(fileName => ({path: path.join(testsDir, fileName)}));
                    } else {
                        throw new Error("Request must contain a 'tests' array or directory name containing *.transcript files.");
                    }
                }
                suiteData = new SuiteData(suiteDataObj, request.query);
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
            const { data } = axios.get(suiteURL);
            return new SuiteData(data, query);
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
                resolve(await TestData.fromObject(test, defaults));
            }
            catch (err) {
                reject(new Error(`tests[${index}]: ${err.message}`));
            }
        });
    }
    return Promise.all(tests.map(createData));
}

module.exports = SuiteData;
