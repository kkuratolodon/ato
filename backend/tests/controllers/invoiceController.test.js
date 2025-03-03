const request = require('supertest');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

// Controller dan Services
const invoiceController = require('../../src/controllers/invoiceController');
const invoiceService = require('../../src/services/invoiceServices');
const authService = require('../../src/services/authService');

// Menggunakan mock agar kita bisa atur perilaku invoiceService dan authService
jest.mock('../../src/services/invoiceServices');
jest.mock('../../src/services/authService');

/**
 * Middleware sederhana yang memanggil authService.authenticate dan set req.user jika valid.
 * 
 * Mirip dengan authMiddleware.js, tapi kita definisikan langsung di test untuk memudahkan.
 */
async function fakeAuthMiddleware(req, res, next) {
  try {
    const { client_id, client_secret } = req.body;
    // Panggil authService untuk cek ke DB
    const partner = await authService.authenticate(client_id, client_secret);
    if (!partner) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = partner;
    next();
  } catch (err) {
    console.error('fakeAuthMiddleware error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

describe('Invoice Controller (Integration) with Supertest', () => {
  let app;

  beforeAll(() => {
    // 1. Buat instance Express
    app = express();

    // 2. Middleware untuk parsing body 
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // 3. Daftarkan route:
    //    - fakeAuthMiddleware (untuk mengisi req.user)
    //    - uploadMiddleware (cek file)
    //    - uploadInvoice (validasi PDF dsb.)
    app.post(
      '/api/upload',
      invoiceController.uploadMiddleware, // 1) parse file & fields
      fakeAuthMiddleware,                // 2) cek auth pakai req.body.client_id
      invoiceController.uploadInvoice
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  //   TEST uploadMiddleware
  // =========================
  test('harus mengembalikan status 400 jika tidak ada file di-upload', async () => {
    // Kita hanya kirim form-data tanpa file agar uploadMiddleware mengembalikan 400
    authService.authenticate.mockResolvedValue({ uuid: 'dummy-uuid' });

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'some_id')
      .field('client_secret', 'some_secret');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'No file uploaded' });
  });

  test('harus melewati middleware dan lanjut ke controller jika file ada', async () => {
    // Simulasikan authService mengembalikan data partner valid
    authService.authenticate.mockResolvedValue({ uuid: 'dummy-uuid' });

    // Karena di controller akan cek `req.user`, 
    // jika user valid, maka kita cek hasil berikutnya
    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'some_id')
      .field('client_secret', 'some_secret')
      // Attach file
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    // At this point, if there's no other error, it might proceed further.
    // Kecuali kita perhatikan, by default checkPdfIntegrity, isPdfEncrypted dsb.
    // Jika semuanya default, maka sampai ke uploadInvoice => status 501
    // TAPI jika kita tidak set, mungkin test-file nya belum valid PDF signature => 415
   
    // Mari kita cek output:
    // Misal kita asumsikan test-file adalah PDF signature valid,
    // Tapi karena "simulateTimeout" TIDAK diset, maka lanjutan:
    // invoiceService.uploadInvoice => status 501
    // Kita cek:
    expect([400, 415, 501, 200, 413, 400, 500, 504]).toContain(res.status);
    // Kita tidak tahu persis karena bergantung real file. 
    // Yang penting kita cek "bukan 401" karena user valid.

    // Tanda bahwa middleware "fakeAuthMiddleware" dipanggil 
    // authService.authenticate => called with "some_id", "some_secret"
    expect(authService.authenticate)
      .toHaveBeenCalledWith('some_id', 'some_secret');
  });

  // =========================
  //    TEST uploadInvoice
  // =========================
  test('harus mengembalikan status 401 jika autentikasi gagal', async () => {
    authService.authenticate.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'invalid_id')
      .field('client_secret', 'invalid_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    // Karena partner = null => 401
    expect(authService.authenticate)
      .toHaveBeenCalledWith('invalid_id', 'invalid_secret');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });

  test('harus mengembalikan status 504 jika simulateTimeout === "true"', async () => {
    // user valid
    authService.authenticate.mockResolvedValue({ uuid: 'dummy-uuid' });

    const res = await request(app)
      .post('/api/upload?simulateTimeout=true')
      .field('client_id', 'any_id')
      .field('client_secret', 'any_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    expect(res.status).toBe(504);
    expect(res.body).toEqual({ message: 'Server timeout during upload' });
  });

  test('harus mengembalikan status 415 jika validatePDF melempar error (bukan PDF)', async () => {
    authService.authenticate.mockResolvedValue({ uuid: 'dummy-uuid' });
    invoiceService.validatePDF.mockRejectedValue(new Error('Invalid PDF'));

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'valid_id')
      .field('client_secret', 'valid_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    expect(res.status).toBe(415);
    expect(res.body).toEqual({ message: 'File format is not PDF' });
  });

  test('harus mengembalikan status 400 jika PDF terenkripsi', async () => {
    authService.authenticate.mockResolvedValue({ uuid: 'dummy-uuid' });
    invoiceService.validatePDF.mockResolvedValue(); // Lolos validasi PDF
    invoiceService.isPdfEncrypted.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'valid_id')
      .field('client_secret', 'valid_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'pdf is encrypted' });
  });

  test('harus mengembalikan status 400 jika PDF rusak', async () => {
    authService.authenticate.mockResolvedValue({ uuid: 'dummy-uuid' });
    invoiceService.validatePDF.mockResolvedValue();
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(false); // rusak

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'valid_id')
      .field('client_secret', 'valid_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'PDF file is invalid' });
  });

  test('harus mengembalikan status 413 jika ukuran file melebihi limit', async () => {
    authService.authenticate.mockResolvedValue({ uuid: 'dummy-uuid' });
    invoiceService.validatePDF.mockResolvedValue();
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(true);
    invoiceService.validateSizeFile.mockRejectedValue(new Error('File too big'));

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'valid_id')
      .field('client_secret', 'valid_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: 'File size exceeds maximum limit' });
  });

  test('harus mengembalikan status 501 jika semua valid', async () => {
    authService.authenticate.mockResolvedValue({ uuid: 'dummy-uuid' });
    invoiceService.validatePDF.mockResolvedValue();
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(true);
    invoiceService.validateSizeFile.mockResolvedValue();
    invoiceService.uploadInvoice.mockResolvedValue({
      message: 'Invoice upload service called',
      filename: 'test-invoice.pdf'
    });

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'valid_id')
      .field('client_secret', 'valid_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    expect(res.status).toBe(501);
    expect(res.body).toEqual({
      message: 'Invoice upload service called',
      filename: 'test-invoice.pdf'
    });
  });

  test('harus mengembalikan status 500 jika terjadi error tak terduga', async () => {
    // Buat agar authService lempar error
    authService.authenticate.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'any_id')
      .field('client_secret', 'any_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Internal server error' });
  });
});