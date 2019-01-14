var rp = require("request-promise");

class HTTP {
    static async getJSON(url) {
        var getOptions = {
            method: "GET",
            uri: url,
            json: true
        };
        var response = await rp(getOptions);
        return response;
    }
}

module.exports = HTTP;