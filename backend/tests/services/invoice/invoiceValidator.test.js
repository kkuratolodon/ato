const InvoiceValidator = require('@services/invoice/invoiceValidator');

// No need to mock models or services since the validator doesn't use them directly
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

describe('InvoiceValidator', () => {
  let validator;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a new instance of the validator for each test
    validator = new InvoiceValidator();
  });

  describe('validateFileData', () => {
    test('should not throw error when valid file data is provided', () => {
      const fileData = {
        buffer: Buffer.from('test'),
        originalname: 'test.pdf',
        partnerId: '123'
      };

      expect(() => validator.validateFileData(fileData)).not.toThrow();
    });

    test('should throw error when fileData is null', () => {
      expect(() => validator.validateFileData(null)).toThrow('File not found');
    });

    test('should throw error when fileData is undefined', () => {
      expect(() => validator.validateFileData(undefined)).toThrow('File not found');
    });

    test('should throw error when partnerId is missing', () => {
      const fileData = {
        buffer: Buffer.from('test'),
        originalname: 'test.pdf'
        // partnerId is missing
      };

      expect(() => validator.validateFileData(fileData)).toThrow('Partner ID is required');
    });

    test('should throw error when partnerId is null', () => {
      const fileData = {
        buffer: Buffer.from('test'),
        originalname: 'test.pdf',
        partnerId: null
      };

      expect(() => validator.validateFileData(fileData)).toThrow('Partner ID is required');
    });

    test('should throw error when partnerId is empty string', () => {
      const fileData = {
        buffer: Buffer.from('test'),
        originalname: 'test.pdf',
        partnerId: ''
      };

      expect(() => validator.validateFileData(fileData)).toThrow('Partner ID is required');
    });
  });
});