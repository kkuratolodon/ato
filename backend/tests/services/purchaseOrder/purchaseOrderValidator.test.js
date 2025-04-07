const PurchaseOrderValidator = require('../../../src/services/purchaseOrder/purchaseOrderValidator');

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
  });

  test('should throw error if file data is invalid', () => {
    const fileData = {
      buffer: null,
      originalname: '',
      partnerId: null
    };

    expect(() => validator.validateFileData(fileData)).toThrow('Invalid file');
  });
});
