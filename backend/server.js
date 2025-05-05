const http = require('http');
const app = require('./app'); // Impor aplikasi Express Anda dari app.js
require('dotenv').config(); // Pastikan variabel environment dimuat

const PORT = process.env.PORT || 3000;

// Tentukan batas ukuran header baru (dalam bytes)
// Default Node.js biasanya 8192 (8KB) atau 16384 (16KB)
// Anda perlu nilai yang jauh lebih besar untuk header sepanjang itu.
// Contoh: 65536 (64KB). Sesuaikan berdasarkan kebutuhan maksimal klien.
const MAX_HEADER_SIZE_BYTES = 65536; // Atur sesuai kebutuhan

// Buat server HTTP dengan batas header yang ditingkatkan
const server = http.createServer({
    maxHeaderSize: MAX_HEADER_SIZE_BYTES
}, app); // Teruskan aplikasi Express Anda ke server

// Jalankan server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Maximum header size set to: ${MAX_HEADER_SIZE_BYTES} bytes`);
});

// (Opsional) Tangani error server
server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
});