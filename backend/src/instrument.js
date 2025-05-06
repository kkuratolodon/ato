const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");
require("@sentry/tracing");
require('dotenv').config();

// Detect if running in a test environment
const isTestEnvironment = 
    process.env.NODE_ENV === 'test' || 
    process.env.JEST_WORKER_ID !== undefined || 
    process.env.npm_lifecycle_event === 'test';

// Create a no-op Sentry client for test environments
const noopClient = {
  captureException: () => {},
  captureMessage: () => {},
  addBreadcrumb: () => {},
  startSpan: (operation, callback) => {
    if (typeof callback === 'function') {
      return callback({ end: () => {} });
    }
    return { end: () => {} };
  },
  configureScope: () => {},
  withScope: (callback) => callback({ setTag: () => {}, setExtra: () => {} }),
  setContext: () => {},
  setUser: () => {},
  setTag: () => {},
  setTags: () => {},
  setExtra: () => {},
  setExtras: () => {},
  lastEventId: () => null,
};

// Only initialize Sentry if not in a test environment
if (!isTestEnvironment) {
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
} else {
  console.log('Running in test environment, Sentry reporting disabled');
  module.exports = noopClient;
}