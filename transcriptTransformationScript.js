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
function removeUnnecessaryAttributes(attachment, attributesToRemove) {
    for (attr in attachment) {
        if (typeof attachment[attr] === 'object') {
            removeUnnecessaryAttributes(attachment[attr], attributesToRemove);
        } else if (attributesToRemove.includes(attr)) {
            delete attachment[attr];
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

function convertAttachmentAttributesToCamelCase(attachment, unchangedAttributes) {
    for (attr in attachment) {
        if (typeof attachment[attr] === 'object') {
            convertAttachmentAttributesToCamelCase(attachment[attr], unchangedAttributes);
        } else if (typeof attachment[attr] === 'string' && !unchangedAttributes.includes(attr)) {
            attachment[attr] = attachment[attr].charAt(0).toLowerCase() + attachment[attr].slice(1, attachment[attr].length);
        }
    }
}

// Handler 4
function editAttachmentsAttributes(currEntry) {
    const attributesToRemove = ['horizontalAlignment', 'style', 'version', '$schema'];
    const unchangedAttributes = ['placeholder', 'text', 'type', 'title', 'value', 'id', 'label', 'FoodChoice'];
    if (currEntry['type'] === 'message') {
        if (currEntry.hasOwnProperty("attachments")) {
            const attachments = currEntry["attachments"];
            attachments.forEach(attachment => {
                removeUnnecessaryAttributes(attachment, attributesToRemove);
                convertAttachmentAttributesToCamelCase(attachment, unchangedAttributes);
            });
        }
    }
}

/** This is the main function - It iterates over all entries of the transcript, and applies all handlers on each entry **/
function main(path) {
    let contentBuffer;
    try {
        contentBuffer = fs.readFileSync(path);
    } catch (e) {
        console.log("Cannot open file", e.path);
        return;
    }
    let jsonTranscript = JSON.parse(contentBuffer);
    for (let i = 0; i < jsonTranscript.length; i++) {
        let currEntry = jsonTranscript[i];
        // Here we call to all the handlers we defined
        addSeparationAttribute(currEntry);
        convertNumbersToString(currEntry);
        editAttachmentsAttributes(currEntry);
    }
    try {
        const filename = path.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, ''); // Extracts filename without extension from full path.
        fs.writeFileSync(filename + '_transformed.transcript', JSON.stringify(jsonTranscript));
    } catch (e) {
        console.log("Cannot write file ", e);
    }
}

//Call main with file path as argument.
main(process.argv[2]);
