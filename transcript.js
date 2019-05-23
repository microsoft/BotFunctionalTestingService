var _ = require("underscore");

class Transcript {
    static getMessages(transcript) {
        var messages = (transcript && _.isArray(transcript)) ? _.where(transcript, { type: "message" }) : [];
        messages = _.map(messages, 
                         function(message) {
                             let res = _.pick(message, ["type", "text", "attachments", "speak", "locale", "textFormat", "from", "recipient", "value"]);
                             // if (res.hasOwnProperty("attachments") && res["attachments"][0].hasOwnProperty("content") && res["attachments"][0]["content"].hasOwnProperty("$schema")) {
                             //     delete res["attachments"][0]["content"]["$schema"];
                             // }
                             return res;                           });
        return messages;    
    }
}

module.exports = Transcript;
