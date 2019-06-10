/**
 This script is used for removing attributes from a transcript exported by Bot Framework Emulator.
 Since the Bot Framework Emulator is connected directly to the bot, and not through the Bot Connector,
 there are differences between the messages in the exported transcript and the actual messages polled
 by the Functional Tests application.
 This script accepts one argument - a full path (including the file name) to a transcript file exported by
 Bot Framework Emulator, and creates a new transformed transcript file named "'"transfromed.transcript"
 in the script directory.
 Transformation is done by applying all defined handlers on each entry of the transcript object.
**/

const fs = require('fs');

/** Here we can add all the handlers we need **/
// Handler 1
function removeSchemaAttribute(currEntry) {
    if (currEntry['type'] === 'message') {
        if (currEntry.hasOwnProperty("attachments") && currEntry["attachments"][0].hasOwnProperty("content") && currEntry["attachments"][0]["content"].hasOwnProperty("$schema")) {
            delete currEntry["attachments"][0]["content"]["$schema"];
        }
    }
}

/** This is the main function - It iterates over all entries of the transcript, and applies all handlers on each entry **/
function main(path) {
    let contentBuffer = fs.readFileSync(path);
    let jsonTranscript = JSON.parse(contentBuffer);
    for (let i = 0; i < jsonTranscript.length; i++) {
        let currEntry = jsonTranscript[i];
        // Here we call to all the handlers we defined
        removeSchemaAttribute(currEntry);
    }
    try{
        const filename = path.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, ''); // Extracts filename without extension from full path.
        fs.writeFileSync(filename + '_transformed.transcript', JSON.stringify(jsonTranscript));
    }catch (e){
        console.log("Cannot write file ", e);
    }
}

//Call main with file path as argument.
main(process.argv[2]);
