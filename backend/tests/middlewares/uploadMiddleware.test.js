const handleMulterError = require('../../src/middlewares/multerErrorHandler');

// Mock dependencies
jest.mock('multer', () => {
  // Mock upload function that multer() returns
  const mockUploadFn = jest.fn();
  
  // Mock multer function that returns an object with single method
  const mockMulter = jest.fn(() => ({
    single: jest.fn().mockReturnValue(mockUploadFn)
  }));
  
  // Add necessary properties to make it work like the real multer
  mockMulter.memoryStorage = jest.fn().mockReturnValue({});
  
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
    // Configure the mock upload function to call next
    multer.mockUploadFn.mockImplementation((req, res, next) => {
      next();
    });
    
    await uploadMiddleware(req, res, next);
    
    expect(multer.mockUploadFn).toHaveBeenCalledWith(req, res, next);
    expect(handleMulterError).not.toHaveBeenCalled();
  });
});