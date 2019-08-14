
var stringifySpace = 4;

var Utils = function () {
}

Utils.prototype.stringify = function(obj, space) {
    space = space || stringifySpace;
    return JSON.stringify(obj, null, space);
}

/**
 * Calls @func on each element of @array, each call is delayed by i X @sec seconds, where i is the index of the element
 * in the array (i.e each call will happen @sec seconds after the previous call).
 * @param array
 * @param func
 * @param sec
 * @return promise - a promise that is resolved when all function calls returned.
 */
Utils.prototype.delayedForEachOf = async function (array, func, sec) {
    var n = array.length; // Used as semaphore.
    var promise = new Promise((resolve, reject) => { // This promise is resolved only when all functions finish their execution.
        for (var i = 0; i < array.length; i++) {
            setTimeout(async (i) => {
                try {
                    await func(array[i]);
                }
                catch {
                    reject();
                }
                n--; // Decrease semaphore
                if (n === 0) { // When all functions finish their execution
                    resolve();
                }
            }, i*sec*1000, i)
        }
    } );
    return promise;
}

/**
 * Gets an array of tests data and a @batchSize, and return a 2d-array of tests, each entry holds @batchSize tests (maybe except the last entry)
 * @param testsData
 * @param batchSize
 * @return 2d-array of tests
 */

Utils.prototype.divideIntoBatches = function (testsData, batchSize) {
    if (batchSize < 1 || !Number.isInteger(batchSize)) {
        throw new Error("Invalid environment variable batchSize. BatchSize should be a positive integer");
    }
    var numOfBatches = Math.ceil(testsData.length/batchSize);
    var res = new Array(numOfBatches); // Init batches entries
    for (var i=0; i<res.length; i++) {
        res[i] = new Array();
    }
    for (var i=0; i<testsData.length; i++) {
        res[Math.floor(i/batchSize)][i%batchSize] = testsData[i];
    }
    return res;
}

module.exports = new Utils();
