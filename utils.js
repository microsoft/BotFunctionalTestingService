
var stringifySpace = 4;

var Utils = function () {
}

Utils.prototype.stringify = function(obj, space) {
    space = space || stringifySpace;
    return JSON.stringify(obj, null, space);
}

module.exports = new Utils();