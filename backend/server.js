const Sentry = require("./src/instrument.js");
const app = require("./src/app");

require('dotenv').config();

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
    res.statusCode = 500;
    res.end((res.sentry || "Internal Server Error") + "\n");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
