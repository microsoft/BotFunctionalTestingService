
var stringifySpace = 4;

var Utils = function () {
}

Utils.prototype.stringify = function(obj, space) {
    space = space || stringifySpace;
    return JSON.stringify(obj, null, space);
}

/**
 * Calls @func on each element of @array, each call is delayed by i seconds, where i is the index of the element
 * in the array.
 * @param array
 * @param func
 * @return promise - a promise that is resolved when all function calls returned.
 */
Utils.prototype.delayedForEachOf = async function (array, func) {
    var n = array.length; // Used as semaphore.
    var promise = new Promise((resolve, reject) => { // This promise is resolved only when all functions finish their execution.
        for (var i = 0; i < array.length; i++) {
            setTimeout(async (i) => {
                try {
                    await func(array[i], i);
                }
                catch {
                    reject();
                }
                n--; // Decrease semaphore
                if (n === 0) { // When all functions finish their execution
                    resolve();
                }
            }, i * 1000, i)
        }
    } );
    return promise;
}

module.exports = new Utils();
