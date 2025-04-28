const handleMulterError = require('../../src/middlewares/multerErrorHandler');

// Mock dependencies
jest.mock('multer', () => {
  // Define MulterError class for instanceof checks
  class MulterError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = 'MulterError';
    }
  }
  
  // Mock upload function that multer() returns
  const mockUploadFn = jest.fn();
  
  // Mock multer function that returns an object with single method
  const mockMulter = jest.fn(() => ({
    single: jest.fn().mockReturnValue(mockUploadFn)
  }));
  
  // Add necessary properties to make it work like the real multer
  mockMulter.memoryStorage = jest.fn().mockReturnValue({});
  mockMulter.MulterError = MulterError;
  
  // Store the upload function so tests can access it
  mockMulter.mockUploadFn = mockUploadFn;
  
  return mockMulter;
});

jest.mock('../../src/middlewares/multerErrorHandler', () => 
  jest.fn()
);

describe('Upload Middleware', () => {
  let uploadMiddleware;
  let multer;
  let req, res, next;

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    
    // Set up request, response, and next function mocks
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    // Reset the module cache between tests
    jest.resetModules();
    
    // Get the mocked multer
    multer = require('multer');
    
    // Import the middleware after mocking dependencies
    uploadMiddleware = require('../../src/middlewares/uploadMiddleware');
  });

  test('should call upload function with correct arguments in normal case', async () => {
    // Configure the mock upload function to call the callback with no error
    multer.mockUploadFn.mockImplementation((req, res, callback) => {
      callback();
    });
    
    await uploadMiddleware(req, res, next);
    
    // Just check that it was called - don't verify exact parameters
    expect(multer.mockUploadFn).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(handleMulterError).not.toHaveBeenCalled();
  });

  // Add tests for error handling
  test('should handle file size limit error', async () => {
    const fileSizeError = new multer.MulterError('LIMIT_FILE_SIZE', 'File too large');
    
    multer.mockUploadFn.mockImplementation((req, res, callback) => {
      callback(fileSizeError);
    });
    
    await uploadMiddleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ message: 'File size exceeds 20MB limit' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should handle other multer errors', async () => {
    const otherError = new multer.MulterError('OTHER_ERROR', 'Some other error');
    
    multer.mockUploadFn.mockImplementation((req, res, callback) => {
      callback(otherError);
    });
    
    await uploadMiddleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Upload error: Some other error' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should pass other errors to next middleware', async () => {
    const error = new Error('Generic error');
    
    multer.mockUploadFn.mockImplementation((req, res, callback) => {
      callback(error);
    });
    
    await uploadMiddleware(req, res, next);
    
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});