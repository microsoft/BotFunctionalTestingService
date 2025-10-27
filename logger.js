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
    const copy = {...obj};
    if (!copy || !paths) {
        return;
    }

    for (const path of paths) {
        const pathParts = path.split('.');
        let current = copy;
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (current && typeof current === 'object' && current[pathParts[i]] !== undefined) {
                current = current[pathParts[i]];
            } else {
                current = undefined;
                break;
            }
        }

        if (current && typeof current === 'object' && current[pathParts[pathParts.length - 1]] !== undefined) {
            current[pathParts[pathParts.length - 1]] = '****';
        }
    }
    return copy;
}

const logger = process.env[keyEnvVarName] ? telemetryClientLogger() : consoleLogger();
logger.censorSecrets = censorSecrets;

module.exports = logger;