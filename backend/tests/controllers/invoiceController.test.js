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

describe('Invoice Controller (Integration) with Supertest', () => {
  let app;

  beforeAll(() => {
    // 1. Buat instance Express
    app = express();

    // 2. Middleware untuk parsing body (field text)
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // 3.  Memanggil uploadMiddleware dan uploadInvoice
    app.post(
      '/api/upload',
      invoiceController.uploadMiddleware,
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
    // Kita hanya kirim form-data tanpa file
    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'some_id')
      .field('client_secret', 'some_secret');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'No file uploaded' });
  });

  test('harus melewati middleware dan lanjut ke controller jika file ada', async () => {
    // Kita mock authService supaya 401
    authService.authenticate.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'some_id')
      .field('client_secret', 'some_secret')
      // Attach file
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    // Karena auth false, kita cek di response 401 (artinya middleware berhasil next)
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });

  // =========================
  //    TEST uploadInvoice
  // =========================
  test('harus mengembalikan status 401 jika autentikasi gagal', async () => {
    authService.authenticate.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/upload')
      .field('client_id', 'invalid_id')
      .field('client_secret', 'invalid_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    expect(authService.authenticate)
      .toHaveBeenCalledWith('invalid_id', 'invalid_secret');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });

  test('harus mengembalikan status 504 jika simulateTimeout === "true"', async () => {
    authService.authenticate.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/upload?simulateTimeout=true')
      .field('client_id', 'any_id')
      .field('client_secret', 'any_secret')
      .attach('file', path.join(__dirname, '../test-files/test-invoice.pdf'));

    expect(res.status).toBe(504);
    expect(res.body).toEqual({ message: 'Server timeout during upload' });
  });

  test('harus mengembalikan status 415 jika validatePDF melempar error (bukan PDF)', async () => {
    authService.authenticate.mockResolvedValue(true);
    // Simulasi invoiceService.validatePDF melempar error
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
    authService.authenticate.mockResolvedValue(true);
    invoiceService.validatePDF.mockResolvedValue(); // Lolos validasi
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
    authService.authenticate.mockResolvedValue(true);
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
    authService.authenticate.mockResolvedValue(true);
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
    authService.authenticate.mockResolvedValue(true);
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