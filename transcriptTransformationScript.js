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

// Handler 2
function addSeparationAttribute(currEntry) {
    if (currEntry['type'] === 'message') {
        if (currEntry.hasOwnProperty("attachments") && currEntry["attachments"][0].hasOwnProperty("content") && currEntry["attachments"][0]["content"].hasOwnProperty("body") && currEntry["attachments"][0]["content"]["body"][0].hasOwnProperty("items")) {
            for (var item of currEntry["attachments"][0]["content"]["body"][0]["items"]) {
                if (item.hasOwnProperty("spacing") && item.hasOwnProperty("isSubtle")) {
                    item["separation"] = "strong";
                }
            }
        }

    }
}

function convertColumnsWidthToString(items) {
    for (var column of items["columns"]) {
        if (column.hasOwnProperty("width")) {
            column["width"] = column["width"] + "";
        }
    }
}
// Handler 3
function convertNumbersToString(currEntry) {
    if (currEntry['type'] === 'message') {
        if (currEntry.hasOwnProperty("attachments")) {
            for (var attachment of currEntry["attachments"]) {
                if (attachment.hasOwnProperty("content") && attachment["content"].hasOwnProperty("body")) {
                    for (var bodyItem of attachment["content"]["body"]) {
                        if (bodyItem.hasOwnProperty("columns")) {
                            convertColumnsWidthToString(bodyItem);
                        } else if (bodyItem.hasOwnProperty("items")) {
                            for (var item of bodyItem["items"]) {
                                if (item.hasOwnProperty("columns")) {
                                    convertColumnsWidthToString(item);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// Handler 4
function convertColumnAttributesToCamelCase(currEntry) {
    if (currEntry['type'] === 'message') {
        if (currEntry.hasOwnProperty("attachments")) {
            const attachments = currEntry["attachments"];
            attachments.forEach(attachment => {
                if (attachment.hasOwnProperty("content")) {
                    const content = attachment["content"];
                    if (content.hasOwnProperty("body")) {
                        const contentBody = content["body"][0];
                        if (contentBody.hasOwnProperty("items")) {
                            const bodyItems = contentBody["items"];
                            bodyItems.forEach(bodyItem => {
                                if (bodyItem.hasOwnProperty("columns")) {
                                    const columns = bodyItem["columns"];
                                    columns.forEach(column => {
                                        if (column.hasOwnProperty("items")) {
                                            const colItems = column["items"];
                                            const attributesToEdit = ["size", "weight", "color", "horizontalAlignment", "spacing"];
                                            colItems.forEach(colItem => {
                                                attributesToEdit.forEach(attr => {
                                                    if (colItem.hasOwnProperty(attr)) {
                                                        colItem[attr] = colItem[attr].charAt(0).toLowerCase() + colItem[attr].slice(1, colItem[attr].length);
                                                    }
                                                });
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    }
                }
            });
        }
    }
}


/** This is the main function - It iterates over all entries of the transcript, and applies all handlers on each entry **/
function main(path) {
    console.log("Started");
    let contentBuffer;
    try {
        contentBuffer = fs.readFileSync(path);
    }
    catch (e) {
        console.log("Cannot open file", e.path);
        return;
    }
    let jsonTranscript = JSON.parse(contentBuffer);
    for (let i = 0; i < jsonTranscript.length; i++) {
        let currEntry = jsonTranscript[i];
        // Here we call to all the handlers we defined
        removeSchemaAttribute(currEntry);
        addSeparationAttribute(currEntry);
        convertNumbersToString(currEntry);
        convertColumnAttributesToCamelCase(currEntry);

    }
    try {
        const filename = path.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, ''); // Extracts filename without extension from full path.
        fs.writeFileSync(filename + '_transformed.transcript', JSON.stringify(jsonTranscript));
        console.log("Done");
    } catch (e) {
        console.log("Cannot write file ", e);
    }
}

//Call main with file path as argument.
main(process.argv[2]);
