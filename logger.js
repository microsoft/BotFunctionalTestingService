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

function censorSecrets(obj, paths) {
    const copy = structuredClone(obj);
    if (!copy || !paths) {
        return copy;
    }

    for (const path of paths) {
        const pathParts = path.split('.');
        const lastPathPart = pathParts.pop();
        let current = copy;

        // Traverse to the parent object
        for (const pathPart of pathParts) {
            current = current?.[pathPart];
            if (!current) break;
        }

        // Censor the final property if it exists
        if (current?.[lastPathPart] !== undefined) {
            current[lastPathPart] = '****';
        }
    }
    return copy;
}

const logger = process.env[keyEnvVarName] ? telemetryClientLogger() : consoleLogger();
logger.censorSecrets = censorSecrets;

module.exports = logger;