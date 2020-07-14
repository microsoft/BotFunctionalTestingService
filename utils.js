
var stringifySpace = 4;

var Utils = function () {
}

Utils.prototype.stringify = function(obj, space) {
    space = space || stringifySpace;
    let aaa = JSON.stringify(obj, null, space)
    return aaa;
}

module.exports = new Utils();
