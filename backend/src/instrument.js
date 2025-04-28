const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");
require("@sentry/tracing");
require('dotenv').config();

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || "development",
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: [
        nodeProfilingIntegration(),
    ],
});

module.exports = Sentry;