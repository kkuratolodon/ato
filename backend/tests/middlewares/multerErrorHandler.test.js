const multer = require('multer');
const { uploadMiddleware: invoiceUploadMiddleware } = require('../../src/controllers/invoiceController');
const { uploadMiddleware: purchaseOrderUploadMiddleware } = require('../../src/controllers/purchaseOrderController');

describe('Multer Error Handling Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('Invoice Controller Multer Error Handler', () => {
    test('should handle LIMIT_FILE_SIZE error with 413 status', () => {
      // Access the handleMulterError function directly from the array
      const handleMulterError = invoiceUploadMiddleware[1];
      
      // Create a MulterError with LIMIT_FILE_SIZE code
      const err = new multer.MulterError('LIMIT_FILE_SIZE');
      
      handleMulterError(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'File size exceeds the 20MB limit' 
      });
      expect(next).not.toHaveBeenCalled();
    });
  
    test('should handle other MulterError types with 400 status', () => {
      // Access the handleMulterError function directly from the array
      const handleMulterError = invoiceUploadMiddleware[1];
      
      // Create a different MulterError type
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
      err.message = 'Unexpected field';
      
      handleMulterError(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        message: `Upload error: ${err.message}` 
      });
      expect(next).not.toHaveBeenCalled();
    });
  
    test('should pass non-Multer errors to next middleware', () => {
      // Access the handleMulterError function directly from the array
      const handleMulterError = invoiceUploadMiddleware[1];
      
      // Create a regular Error (not MulterError)
      const err = new Error('Generic error');
      
      handleMulterError(err, req, res, next);
      
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(err);
    });

    test('should have two middleware functions', () => {
      expect(Array.isArray(invoiceUploadMiddleware)).toBe(true);
      expect(invoiceUploadMiddleware.length).toBe(2);
      
      // First middleware should be multer
      expect(typeof invoiceUploadMiddleware[0]).toBe('function');
      // Second middleware should be handleMulterError
      expect(typeof invoiceUploadMiddleware[1]).toBe('function');
    });
  });

  describe('Purchase Order Controller Multer Error Handler', () => {
    test('should handle LIMIT_FILE_SIZE error with 413 status', () => {
      // Access the handleMulterError function directly from the array
      const handleMulterError = purchaseOrderUploadMiddleware[1];
      
      // Create a MulterError with LIMIT_FILE_SIZE code
      const err = new multer.MulterError('LIMIT_FILE_SIZE');
      
      handleMulterError(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'File size exceeds the 20MB limit' 
      });
      expect(next).not.toHaveBeenCalled();
    });
  
    test('should handle other MulterError types with 400 status', () => {
      // Access the handleMulterError function directly from the array
      const handleMulterError = purchaseOrderUploadMiddleware[1];
      
      // Create a different MulterError type
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
      err.message = 'Unexpected field';
      
      handleMulterError(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        message: `Upload error: ${err.message}` 
      });
      expect(next).not.toHaveBeenCalled();
    });
  
    test('should pass non-Multer errors to next middleware', () => {
      // Access the handleMulterError function directly from the array
      const handleMulterError = purchaseOrderUploadMiddleware[1];
      
      // Create a regular Error (not MulterError)
      const err = new Error('Generic error');
      
      handleMulterError(err, req, res, next);
      
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(err);
    });

    test('should have two middleware functions', () => {
      expect(Array.isArray(purchaseOrderUploadMiddleware)).toBe(true);
      expect(purchaseOrderUploadMiddleware.length).toBe(2);
      
      // First middleware should be multer
      expect(typeof purchaseOrderUploadMiddleware[0]).toBe('function');
      // Second middleware should be handleMulterError
      expect(typeof purchaseOrderUploadMiddleware[1]).toBe('function');
    });
  });

  describe('Shared functionality', () => {
    test('both handlers should handle errors identically', () => {
      // This test verifies that both error handlers respond the same way
      // to the same error, ensuring consistent behavior across controllers
      const invoiceHandler = invoiceUploadMiddleware[1];
      const purchaseOrderHandler = purchaseOrderUploadMiddleware[1];
      
      // Create a MulterError with LIMIT_FILE_SIZE code
      const err = new multer.MulterError('LIMIT_FILE_SIZE');
      
      // Create fresh mock objects for each handler
      const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      
      // Call both handlers with identical errors
      invoiceHandler(err, req, res1, next);
      purchaseOrderHandler(err, req, res2, next);
      
      // Verify they respond identically
      expect(res1.status).toHaveBeenCalledWith(413);
      expect(res2.status).toHaveBeenCalledWith(413);
      expect(res1.json.mock.calls[0][0]).toEqual(res2.json.mock.calls[0][0]);
    });
  });
});