const { nodeProfilingIntegration } = require("@sentry/profiling-node");
const Sentry = require("@sentry/node");
require('dotenv').config();


Sentry.init({
  dsn: process.env.DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [
    nodeProfilingIntegration(),
  ],
});


module.exports = Sentry;