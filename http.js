var fetch = require("node-fetch");

class HTTP {
    static async getJSON(url) {
        var getOptions = {
            method: "GET",
            uri: url,
            json: true
        };
        var response = await fetch(url)
        return response.json();
    }
}

module.exports = HTTP;