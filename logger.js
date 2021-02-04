const { format } = require("util");
const { TelemetryClient } = require("applicationinsights");
const config = require("./config.json");

const keyEnvVarName = "ApplicationInsightsInstrumentationKey";

function telemetryClientLogger() {
    const telemetryClient = new TelemetryClient(process.env[keyEnvVarName]);
    telemetryClient.context.tags["ai.cloud.role"] = process.env["roleName"] || config.defaults.defaultRoleName;

    return {
        log(...args) {
            telemetryClient.trackTrace({ message: format(...args) });
            telemetryClient.flush();
            console.log(...args);
        },
        event(name, properties) {
            telemetryClient.trackEvent({ name, properties });
        }
    };
}

function consoleLogger() {
    return {
        log(...args) {
            console.log(...args);
        },
        event(name, properties) {}
    };
}

module.exports = process.env[keyEnvVarName] ? telemetryClientLogger() : consoleLogger();