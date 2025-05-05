const http = require('http');
const Sentry = require("./src/instrument.js");
const app = require("./src/app");

require('dotenv').config();

// Anda tidak perlu lagi meningkatkan batas ini jika tujuannya adalah menangani error
// Anda bisa menghapus atau mengembalikan ke default (misal: 8192 atau 16384)
// const MAX_HEADER_SIZE_BYTES = 65536; // Hapus atau kembalikan ke nilai default
const PORT = process.env.PORT || 3000;

Sentry.setupExpressErrorHandler(app);

app.use(function onError(err, req, res, next) {
    console.error(`Error: ${err.message}`);
    console.error(`Stack: ${err.stack}`);
    console.error(`Request URL: ${req.originalUrl}`);
    console.error(`Request Method: ${req.method}`);

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

// Buat server HTTP (tanpa opsi maxHeaderSize jika Anda tidak ingin menaikkannya)
const server = http.createServer(
    // Hapus opsi maxHeaderSize dari sini jika tidak ingin menaikkan limit
    // { maxHeaderSize: MAX_HEADER_SIZE_BYTES }
    app
);

// --- TAMBAHKAN HANDLER UNTUK 'clientError' DI SINI ---
server.on('clientError', (err, socket) => {
    // Periksa secara spesifik error header overflow
    if (err.code === 'HPE_HEADER_OVERFLOW') {
        console.error('Client Error: Header Overflow - ', err.message);
        // Kirim respons 431 secara manual karena middleware Express belum berjalan
        socket.write('HTTP/1.1 431 Request Header Fields Too Large\r\n');
        socket.write('Content-Type: application/json\r\n');
        socket.write('Connection: close\r\n');
        socket.write('\r\n'); // Akhir dari header
        socket.write(JSON.stringify({
            error: {
                code: 'HEADER_FIELDS_TOO_LARGE',
                message: 'Request header fields are too large. Please reduce the size of headers like client_id.'
            }
        }));
        socket.end(); // Pastikan respons selesai dikirim
        socket.destroy(err); // Tutup socket setelah mengirim respons
    } else {
        // Untuk error klien lainnya, log dan biarkan Node.js menanganinya (biasanya menutup socket)
        console.error('Client Error:', err);
        // Penting untuk menutup socket pada error klien agar tidak menggantung
        if (socket.writable) {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
        socket.destroy(err);
    }
});
// --- AKHIR HANDLER 'clientError' ---

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // Hapus log ini jika Anda tidak lagi mengatur maxHeaderSize secara manual
    // console.log(`Maximum header size set to: ${MAX_HEADER_SIZE_BYTES} bytes`);
});

server.on('error', (error) => {
    console.error('Server error:', error);
    Sentry.captureException(error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    Sentry.captureException(reason || new Error('Unhandled Rejection'), {
        extra: { promise, reason }
    });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    Sentry.captureException(error);
    process.exit(1);
});