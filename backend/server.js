const http = require('http');
const Sentry = require("./src/instrument.js");
const app = require("./src/app");

require('dotenv').config();

const PORT = process.env.PORT || 3000;

Sentry.setupExpressErrorHandler(app);

app.use(function onError(err, req, res, next) {
    console.error(`[${new Date().toISOString()}] Express Error: ${err.message}`);
    console.error(`[${new Date().toISOString()}] Stack: ${err.stack}`);
    console.error(`[${new Date().toISOString()}] Request URL: ${req.originalUrl}`);
    console.error(`[${new Date().toISOString()}] Request Method: ${req.method}`);

    if (!res.headersSent) {
        const statusCode = err.status || 500;
        res.status(statusCode).json({
            error: {
                message: err.message || "Internal Server Error",
                sentry_id: res.sentry
            }
        });
    } else {
        next(err);
    }
});

const server = http.createServer(app);

server.on('clientError', (err, socket) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Client Error Triggered. Code: ${err.code}. Socket Writable: ${socket.writable}. Socket Destroyed: ${socket.destroyed}`);

    if (socket.destroyed) {
        return;
    }

    let responseSent = false;
    try {
        if (err.code === 'HPE_HEADER_OVERFLOW') {
            console.error(`[${timestamp}] Handling HPE_HEADER_OVERFLOW.`);
            if (socket.writable) {
                const responseBody = JSON.stringify({
                    error: { code: 'HEADER_FIELDS_TOO_LARGE', message: 'Request header fields are too large.' }
                });
                const responseHeaders = [
                    'HTTP/1.1 431 Request Header Fields Too Large',
                    'Content-Type: application/json',
                    `Content-Length: ${Buffer.byteLength(responseBody)}`,
                    'Connection: close',
                    '\r\n'
                ];
                socket.write(responseHeaders.join('\r\n'));
                socket.write(responseBody);
                socket.end(() => {
                    responseSent = true;
                    if (!socket.destroyed) {
                        socket.destroy(err);
                    }
                });
            } else {
                socket.destroy(err);
            }
        } else {
            console.error(`[${timestamp}] Handling other client error: ${err.code}`);
            if (socket.writable) {
                const responseBody = JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Bad Request' } });
                const responseHeaders = [
                    'HTTP/1.1 400 Bad Request',
                    'Content-Type: application/json',
                    `Content-Length: ${Buffer.byteLength(responseBody)}`,
                    'Connection: close',
                    '\r\n'
                ];
                socket.write(responseHeaders.join('\r\n'));
                socket.write(responseBody);
                socket.end(() => {
                    responseSent = true;
                    if (!socket.destroyed) {
                        socket.destroy(err);
                    }
                });
            } else {
                socket.destroy(err);
            }
        }
    } catch (e) {
        console.error(`[${timestamp}] Exception during clientError handling:`, e);
        if (!socket.destroyed) {
            socket.destroy(err);
        }
    } finally {
        setTimeout(() => {
            if (!responseSent && !socket.destroyed) {
                console.warn(`[${timestamp}] Force destroying socket as a fallback.`);
                socket.destroy(err);
            }
        }, 100);
    }
});


server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

server.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] Server Error:`, error);
    Sentry.captureException(error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] Unhandled Rejection at:`, promise, 'reason:', reason);
    Sentry.captureException(reason || new Error('Unhandled Rejection'), {
        extra: { promise, reason }
    });
});

process.on('uncaughtException', (error) => {
    console.error(`[${new Date().toISOString()}] Uncaught Exception:`, error);
    Sentry.captureException(error);
    process.exit(1);
});