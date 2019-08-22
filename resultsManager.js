const crypto = require('crypto');

let activeRunIds = new Set(); // runId is an identifier for a suite run.
let runIdToResults = {}; // runId --> [arrayOfResults, verdict]

/**
 * Returns the set of activeRunIds
 * @return activeRunIds
 */
function getActiveRunIds() {
    return activeRunIds;
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
function updateSuiteResults (runId, testResults, errorMessage, verdict) {
    if (activeRunIds.has(runId)) {
        runIdToResults[runId] = {};
        runIdToResults[runId]["results"] = testResults;
        runIdToResults[runId]["errorMessage"] = errorMessage;
        runIdToResults[runId]["verdict"] = verdict;
    }
}

/**
* Deletes results of a suite given runId from resultsManagerInstance.runIds and from resultsManagerInstance.runIdToResults.
* @param runId
* @return void
*/
function deleteSuiteResult(runId) {
    if (activeRunIds.has(runId)) {
        activeRunIds.delete(runId);
        delete runIdToResults[runId];
    }
}

/**
* Returns the test results of a given runId.
* @param runId
* @return The array representing the tests results of the given runId. If test results is not ready, null is returned.
*/
function getSuiteResults(runId) {
    if (runIdToResults.hasOwnProperty(runId)) { // If test results are ready
        return runIdToResults[runId]; // Return them.
    }
    else {
        return null; // Else, null is returned.
    }
}

module.exports = {getActiveRunIds, getFreshRunId, updateSuiteResults, deleteSuiteResult, getSuiteResults};

