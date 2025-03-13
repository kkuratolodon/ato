const path = require('path');
const fs = require('fs');
const s3Service = require('../../src/services/s3Service');
const purchaseOrderService = require('../../src/services/purchaseOrderService');
const { PurchaseOrder } = require('../../src/models');

jest.mock('../../src/services/s3Service', () => ({
    uploadFile: jest.fn()
}));

jest.mock('../../src/models', () => ({
    PurchaseOrder: {
        findByPk: jest.fn(),
        create: jest.fn(), 
        update: jest.fn()
    }
}));
describe('uploadPurchaseOrder', () => {
  const TEST_FILE_PATH = path.join(__dirname, '..', 'controllers', 'test-files', 'test-invoice.pdf');
  const TEST_FILE = { buffer: fs.readFileSync(TEST_FILE_PATH) };
  const TEST_S3_URL = 'https://s3.amazonaws.com/test-bucket/test-purchase-order.pdf';

  let mockParams, mockPartnerId;

  beforeEach(() => {
    mockPartnerId = 'partner-123';
    mockParams = { 
      buffer: TEST_FILE.buffer, 
      partnerId: mockPartnerId,
      originalname: 'test-purchase-order.pdf'
    };

    jest.clearAllMocks();
  });

  test('should return purchase order object when upload is successful', async () => {
    s3Service.uploadFile.mockResolvedValue(TEST_S3_URL);
    const mockPurchaseOrderData = {
      id: 1,
      partner_id: mockPartnerId,
      file_url: TEST_S3_URL,
      status: "Processing",
      created_at: new Date()
    };

    // Mocking database operations
    PurchaseOrder.create.mockResolvedValue(mockPurchaseOrderData);

    const result = await purchaseOrderService.uploadPurchaseOrder(mockParams);
    expect(s3Service.uploadFile).toHaveBeenCalledWith(TEST_FILE.buffer);
    expect(PurchaseOrder.create).toHaveBeenCalledWith({
      partner_id: mockPartnerId,
      file_url: TEST_S3_URL,
      status: "Processing"
    });
    expect(result).toHaveProperty('message', 'Purchase Order successfully uploaded');
  });

  test('should raise error when S3 upload fails', async () => {
    s3Service.uploadFile.mockRejectedValue(new Error('Failed to upload file to S3'));

    await expect(purchaseOrderService.uploadPurchaseOrder(mockParams)).rejects.toThrow('Failed to upload file to S3');
  });

  test('should raise error when saving to database fails', async () => {
    s3Service.uploadFile.mockResolvedValue(TEST_S3_URL);
    PurchaseOrder.create.mockRejectedValue(new Error('Failed to save purchase order to database'));

    await expect(purchaseOrderService.uploadPurchaseOrder(mockParams)).rejects.toThrow('Failed to save purchase order to database');
  });

});
