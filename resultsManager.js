const crypto = require('crypto');
const fs = require('fs')
var mkdirp = require('mkdirp');

let activeRunIds = new Set(); // runId is an identifier for a suite run.
let runIdToResults = {}; // runId --> [arrayOfResults, verdict]

/**
 * Returns if the runId exist
 * @return activeRunIds
 */
async function hasRunIds(runId) {
    if (activeRunIds.has(runId)) {
        return true
    } else {
        return await fs.existsSync(getPath(runId))
    }
}

/**
* Returns a random RunId that is currently not in use. This function also updates the set of active run ids.
* @return string fresh Id
*/
 function getFreshRunId() {
    let res = crypto.randomBytes(8).toString('hex');
    while (activeRunIds.has(res)) { // Ensures that the runId is currently unique.
        res = crypto.randomBytes(8).toString('hex');
    }
    activeRunIds.add(res);
    mkdirp(getPath(""), function(err) { 
        if(!err){
            fs.writeFile(getPath(res), "",function(err){
                console.log(err)
            });
        }   
        // path exists unless there was an error
    });
    return res;
}

/**
* Updates the results of a suite, given test id (runId), array of test results and a verdict ("success", "failure").
* @param runId
* @param testResults
* @param errorMessage
* @param verdict
* @return void
*
*/
 function updateSuiteResults(runId, testResults, errorMessage, verdict) {

    let data = {
        results: testResults,
        errorMessage: errorMessage,
        verdict: verdict
    }

    if (activeRunIds.has(runId)) {
        runIdToResults[runId] = data
    }

    //write to file to support multi instance app
    fs.writeFile(getPath(runId), JSON.stringify(data),function(err){
        console.log(err)
    });
}

/**
* Deletes results of a suite given runId from resultsManagerInstance.runIds and from resultsManagerInstance.runIdToResults.
* @param runId
* @return void
*/
async function deleteSuiteResult(runId) {
    if (activeRunIds.has(runId)) {
        activeRunIds.delete(runId);
        delete runIdToResults[runId];
    }

    //delete from file
    await fs.unlink(getPath(runId), JSON.stringify(data))
}

/**
* Returns the test results of a given runId.
* @param runId
* @return The array representing the tests results of the given runId. If test results is not ready, null is returned.
*/
async function getSuiteResults(runId) {
    if (runIdToResults.hasOwnProperty(runId) && false) { // If test results are ready
        return runIdToResults[runId]; // Return them.
    }
    else {

        if (await fs.existsSync(getPath(runId))) {
            var data = await fs.readFileSync(getPath(runId))
            if (data.length > 0) {
                return JSON.parse(data)
            }
        }
    }
    return null; // Else, null is returned.
}


function getPath(runId) {
    if(runId){
        return `/home/${runId}.json`;
    }else{
        return `/home`;
    }
}

module.exports = { hasRunIds, getFreshRunId, updateSuiteResults, deleteSuiteResult, getSuiteResults };

