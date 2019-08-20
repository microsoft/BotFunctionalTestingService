const crypto = require('crypto');

let resultsManagerInstance;

/**
 * Initializes the results manager if it wasn't initialized before.
 * @return void
 */
function init() {
    if (!resultsManagerInstance) {
        resultsManagerInstance = {};
        resultsManagerInstance.activeRunIds = new Set(); // runId is an identifier for a suite run.
        resultsManagerInstance.runIdToResults = {}; // runId --> [arrayOfResults, verdict]
    }
}

/**
 * Returns the set of activeRunIds
 * @return activeRunIds
 */
function getActiveRunIds() {
    return resultsManagerInstance["activeRunIds"];
}

/**
* Returns a random RunId that is currently not in use. This function also updates the set of active run ids.
* @return A fresh Id
*/
function getFreshRunId() {
    var res = crypto.randomBytes(8).toString('hex');
    while (resultsManagerInstance.activeRunIds.has(res)) { // Ensures that the runId is currently unique.
        res = crypto.randomBytes(8).toString('hex');
    }
    resultsManagerInstance.activeRunIds.add(res);
    return res;
}

/**
* Updates the results of a suite, given test id (runId), array of test results and a verdict ("success", "failure").
* @param runId
* @param testResults
* @param verdict
* @return void
*
*/
function updateSuiteResults (runId, testResults, verdict) {
    if (resultsManagerInstance.activeRunIds.has(runId)) {
        resultsManagerInstance.runIdToResults[runId] = new Array(2);
        resultsManagerInstance.runIdToResults[runId][0] = testResults;
        resultsManagerInstance.runIdToResults[runId][1] = verdict;
    }
}

/**
* Deletes results of a suite given runId from resultsManagerInstance.runIds and from resultsManagerInstance.runIdToResults.
* @param runId
* @return void
*/
function deleteSuiteResult(runId) {
    if (resultsManagerInstance.activeRunIds.has(runId)) {
        resultsManagerInstance.activeRunIds.delete(runId);
        delete resultsManagerInstance.runIdToResults[runId];
    }
}

/**
* Returns the test results of a given runId.
* @param runId
* @return The array representing the tests results of the given runId. If test results is not ready, null is returned.
*/
function getSuiteResults(runId) {
    if (resultsManagerInstance.runIdToResults.hasOwnProperty(runId)) { // If test results are ready
        return resultsManagerInstance.runIdToResults[runId]; // Return them.
    }
    else {
        return null; // Else, null is returned.
    }
}

module.exports = {init, getActiveRunIds, getFreshRunId, updateSuiteResults, deleteSuiteResult, getSuiteResults}
