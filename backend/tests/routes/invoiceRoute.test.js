const request = require('supertest');
const express = require('express');

// Mock agar kita tidak memanggil implementasi asli
jest.mock('../../src/middlewares/authMiddleware');
jest.mock('../../src/middlewares/uploadMiddleware'); 
jest.mock('../../src/controllers/invoiceController', () => ({
  controller: {
    uploadInvoice: jest.fn((req, res) => res.end()),
    getInvoiceById: jest.fn(),
    analyzeInvoice: jest.fn(), 
    deleteInvoiceById: jest.fn()
  }  
}));

// Import after mocking
const { controller: invoiceController } = require('../../src/controllers/invoiceController');
const authMiddleware = require('../../src/middlewares/authMiddleware');
const uploadMiddleware = require('../../src/middlewares/uploadMiddleware');
const invoiceRoutes = require('../../src/routes/invoiceRoute');

describe('Invoice Routes', () => {
  let app;

  beforeAll(() => {
    // 1. Buat instance Express
    app = express();
    // 2. Pakai JSON parser (opsional, jika kita kirim JSON body)
    app.use(express.json());
    // 3. Daftarkan route ke /api/invoices
    app.use('/api/invoices', invoiceRoutes);
  });

  beforeEach(() => {
    // Pastikan setiap test bersih
    jest.clearAllMocks();
    
    invoiceController.uploadMiddleware = [
      jest.fn().mockImplementation((req, res, next) => next()),
      jest.fn().mockImplementation((err, req, res, next) => next())
    ];
  });

  test('POST /api/invoices/upload memanggil authMiddleware, uploadMiddleware, dan uploadInvoice', async () => {
    // 1. Mock semua agar tidak ada logika asli
    authMiddleware.mockImplementation((req, res, next) => {
      // Asumsikan user lolos auth
      return next();
    });
    uploadMiddleware.mockImplementation((req, res, next) => {
      // Asumsikan file di-attach
      return next();
    });
    invoiceController.uploadInvoice.mockImplementation((req, res) => {
      return res.status(200).json({ success: true });
    });

    // 2. Lakukan request ke /api/invoices/upload
    const response = await request(app)
      .post('/api/invoices/upload')
      .field('client_id', 'someId')
      .field('client_secret', 'someSecret');

    // 3. Pastikan status 200 (dari mock)
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });

    // 4. Pastikan ketiga fungsi dipanggil
    expect(authMiddleware).toHaveBeenCalledTimes(1);
    expect(uploadMiddleware).toHaveBeenCalledTimes(1);
    expect(invoiceController.uploadInvoice).toHaveBeenCalledTimes(1);
  });

  test('POST /api/invoices/upload harus return 401 jika authMiddleware memanggil res.status(401)', async () => {
    // 1. Mock authMiddleware -> balas 401
    authMiddleware.mockImplementation((req, res) => {
      return res.status(401).json({ message: 'Unauthorized' });
    });

    // 2. Middleware/controller lain seharusnya tidak dipanggil
    uploadMiddleware.mockImplementation((req, res, next) => next());
    invoiceController.uploadInvoice.mockImplementation((req, res) => res.end());

    // 3. Lakukan request
    const response = await request(app)
      .post('/api/invoices/upload')
      .field('client_id', 'wrong')
      .field('client_secret', 'wrong');

    // 4. Cek respons 401
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized' });

    // 5. Pastikan uploadMiddleware & uploadInvoice tidak dipanggil
    expect(uploadMiddleware).not.toHaveBeenCalled();
    expect(invoiceController.uploadInvoice).not.toHaveBeenCalled();
  });
  
  test('GET /api/invoices/debug-sentry should throw an error for Sentry testing', async () => {
    // Express error handler needs to be set up to catch the error
    app.use((err, req, res) => {
        res.status(500).json({ message: 'Server error' });
    });

    // Make request to the sentry debug endpoint
    const response = await request(app)
        .get('/api/invoices/debug-sentry');
    
    // Since this endpoint explicitly throws an error, expect 500 status
    expect(response.status).toBe(500);
  });
});


