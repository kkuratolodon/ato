const PurchaseOrderValidator = require('@services/purchaseOrder/purchaseOrderValidator');

describe('PurchaseOrderValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new PurchaseOrderValidator();
  });

  test('should validate file data successfully', () => {
    const fileData = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };

    expect(() => validator.validateFileData(fileData)).not.toThrow();
    // Should return true on successful validation
    expect(validator.validateFileData(fileData)).toBe(true);
  });

  test('should throw error if file data is missing', () => {
    expect(() => validator.validateFileData(null)).toThrow('Missing file data');
    expect(() => validator.validateFileData(undefined)).toThrow('Missing file data');
  });

  test('should throw error if buffer is missing or empty', () => {
    // Case: missing buffer
    const missingBuffer = {
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };
    expect(() => validator.validateFileData(missingBuffer)).toThrow('Invalid file: empty or missing content');

    // Case: empty buffer
    const emptyBuffer = {
      buffer: Buffer.from(''),
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };
    expect(() => validator.validateFileData(emptyBuffer)).toThrow('Invalid file: empty or missing content');
  });

  test('should throw error if originalname is missing', () => {
    const fileData = {
      buffer: Buffer.from('test'),
      partnerId: 'partner-123'
    };

    expect(() => validator.validateFileData(fileData)).toThrow('Invalid file: missing filename');
  });

  test('should throw error if partnerId is missing', () => {
    const fileData = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf'
    };

    expect(() => validator.validateFileData(fileData)).toThrow('Partner ID is required');
  });
});
