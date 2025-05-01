require('module-alias')(__dirname);
const Sentry = require("./src/instrument.js");
const app = require("./src/app");

require('dotenv').config();

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

app.use(function onError(err, req, res, next) {
    console.error(`Error: ${err.message}`);
    console.error(`Request URL: ${req.originalUrl}`);
    console.error(`Request Method: ${req.method}`);
    console.error(`Request Headers:`, req.headers);

    res.statusCode = 500;
    res.end((res.sentry || "Internal Server Error") + "\n");

    next(err); // Forward to the next error handler if any
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
