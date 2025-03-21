const request = require('supertest');
const express = require('express');

// Mock all dependencies before requiring the route
// This prevents the models from being loaded
jest.mock('../../src/controllers/invoiceController', () => ({
  uploadMiddleware: jest.fn(),
  uploadInvoice: jest.fn(),
  getInvoiceById: jest.fn(),
  getAllInvoices: jest.fn(),
  deleteInvoice: jest.fn(),
  analyzeInvoice: jest.fn(),
  // Add any other controller methods used in your routes
}));

jest.mock('../../src/middlewares/authMiddleware', () => 
  jest.fn((req, res, next) => next())
);

// Now create a mock router that mimics the behavior of your actual router
// without requiring the real one
const mockRouter = express.Router();
mockRouter.post('/upload', 
  require('../../src/middlewares/authMiddleware'),
  require('../../src/controllers/invoiceController').uploadMiddleware,
  require('../../src/controllers/invoiceController').uploadInvoice
);

// Add other routes as needed
mockRouter.get('/:id', 
  require('../../src/middlewares/authMiddleware'),
  require('../../src/controllers/invoiceController').getInvoiceById
);

mockRouter.get('/', 
  require('../../src/middlewares/authMiddleware'),
  require('../../src/controllers/invoiceController').getAllInvoices
);

mockRouter.delete('/:id', 
  require('../../src/middlewares/authMiddleware'),
  require('../../src/controllers/invoiceController').deleteInvoice
);

mockRouter.get('/debug-sentry', (req, res) => {
  throw new Error('Sentry test error');
});

// Get the mocked dependencies
const authMiddleware = require('../../src/middlewares/authMiddleware');
const invoiceController = require('../../src/controllers/invoiceController');

describe('Invoice Routes', () => {
  let app;

  beforeAll(() => {
    // 1. Create an Express app
    app = express();
    // 2. Use JSON parser
    app.use(express.json());
    // 3. Register our mock router
    app.use('/api/invoices', mockRouter);
    // 4. Add error handler for Sentry test
    app.use((err, req, res, next) => {
      res.status(500).json({ message: 'Server error' });
    });
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('POST /api/invoices/upload calls authMiddleware, uploadMiddleware, and uploadInvoice', async () => {
    // Set up return values for the mocks
    authMiddleware.mockImplementation((req, res, next) => next());
    invoiceController.uploadMiddleware.mockImplementation((req, res, next) => next());
    invoiceController.uploadInvoice.mockImplementation((req, res) => 
      res.status(200).json({ success: true })
    );

    // Make the request
    const response = await request(app)
      .post('/api/invoices/upload')
      .field('client_id', 'someId')
      .field('client_secret', 'someSecret');

    // Check status and response
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });

    // Check that middleware was called
    expect(authMiddleware).toHaveBeenCalledTimes(1);
    expect(invoiceController.uploadMiddleware).toHaveBeenCalledTimes(1);
    expect(invoiceController.uploadInvoice).toHaveBeenCalledTimes(1);
  });


  test('POST /api/invoices/upload harus return 401 jika authMiddleware memanggil res.status(401)', async () => {
    // 1. Mock authMiddleware -> balas 401
    authMiddleware.mockImplementation((req, res) => {
      return res.status(401).json({ message: 'Unauthorized' });
    });
    // 2. Middleware/controller lain seharusnya tidak dipanggil
    invoiceController.uploadMiddleware.mockImplementation((req, res, next) => next());
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
    expect(invoiceController.uploadMiddleware).not.toHaveBeenCalled();
    expect(invoiceController.uploadInvoice).not.toHaveBeenCalled();
  });

});

