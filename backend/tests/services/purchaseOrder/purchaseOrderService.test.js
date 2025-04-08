const PurchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');
const PurchaseOrderRepository = require('../../../src/repositories/purchaseOrderRepository');
const PurchaseOrderValidator = require('../../../src/services/purchaseOrder/purchaseOrderValidator');
const PurchaseOrderResponseFormatter = require('../../../src/services/purchaseOrder/purchaseOrderResponseFormatter');
const Sentry = require('../../../src/instrument');

jest.mock('../../../src/repositories/purchaseOrderRepository');
jest.mock('../../../src/services/purchaseOrder/purchaseOrderValidator');
jest.mock('../../../src/services/purchaseOrder/purchaseOrderResponseFormatter');
jest.mock('../../../src/instrument');

// Mock uuid to return a predictable value
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-1234')
}));

describe('PurchaseOrderService', () => {
  let service;
  let originalProcessAsync;

  beforeEach(() => {
    service = PurchaseOrderService; // Use the singleton instance directly
    jest.clearAllMocks();
    
    // Save the original implementation
    originalProcessAsync = service.processPurchaseOrderAsync;
    
    // Setup general mocks
    service.uploadFile = jest.fn().mockResolvedValue({ 
      fileUrl: 'https://example.com/file.pdf',
      analysisJsonUrl: 'https://example.com/analysis.json'
    });
    service.purchaseOrderRepository.createInitial = jest.fn().mockResolvedValue();
    service.purchaseOrderRepository.updateStatus = jest.fn().mockResolvedValue();
    service.purchaseOrderRepository.findById = jest.fn();
    service.validator.validateFileData = jest.fn();
    service.responseFormatter.formatPurchaseOrderResponse = jest.fn();
    
    // Don't mock processPurchaseOrderAsync by default to use the real implementation
    
    // Sentry mocks
    Sentry.addBreadcrumb = jest.fn();
    Sentry.captureException = jest.fn();
    Sentry.captureMessage = jest.fn();
    
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
    // Restore the original implementation
    service.processPurchaseOrderAsync = originalProcessAsync;
  });

  test('should handle errors during async processing', async () => {
    const purchaseOrderId = 'mock-id';
    const buffer = Buffer.from('test');
    const partnerId = 'partner-123';

    // Create an error that will be thrown inside the method
    const testError = new Error('Processing error');
    service.purchaseOrderRepository.updateStatus.mockImplementationOnce(() => {
      // This will throw the first time it's called (during the normal flow)
      throw testError;
    });

    // Call the actual method, which should catch the error
    await service.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId);

    // Verify error handling
    expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    expect(service.purchaseOrderRepository.updateStatus).toHaveBeenCalledTimes(2);
    // First call - fails with error
    // Second call - the error handling updates status to "Failed"
    expect(service.purchaseOrderRepository.updateStatus.mock.calls[1][0]).toBe(purchaseOrderId);
    expect(service.purchaseOrderRepository.updateStatus.mock.calls[1][1]).toBe('Failed');
  });

  test('should successfully process purchase order async', async () => {
    const purchaseOrderId = 'mock-id';
    const buffer = Buffer.from('test');
    const partnerId = 'partner-123';

    // Call the method
    await service.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId);

    // Verify the expected behavior
    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(service.purchaseOrderRepository.updateStatus).toHaveBeenCalledWith(purchaseOrderId, 'Analyzed');
    expect(Sentry.captureMessage).toHaveBeenCalledWith(`Successfully completed processing purchase order ${purchaseOrderId}`);
  });

  test('should successfully upload a purchase order', async () => {
    // Setup test data
    const fileData = {
      buffer: Buffer.from('test file content'),
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };

    // Mock processPurchaseOrderAsync only for this test
    service.processPurchaseOrderAsync = jest.fn().mockResolvedValue();

    // Call the method
    const result = await service.uploadPurchaseOrder(fileData);

    // Verify the expected behavior
    expect(service.validator.validateFileData).toHaveBeenCalledWith(fileData);
    expect(service.uploadFile).toHaveBeenCalledWith(fileData);
    expect(service.purchaseOrderRepository.createInitial).toHaveBeenCalledWith({
      id: 'test-uuid-1234',
      status: 'Processing',
      partner_id: 'partner-123',
      file_url: 'https://example.com/file.pdf',
      original_filename: 'test.pdf',
      file_size: fileData.buffer.length,
      analysis_json_url: 'https://example.com/analysis.json'
    });
    expect(service.processPurchaseOrderAsync).toHaveBeenCalledWith('test-uuid-1234', fileData.buffer, fileData.partnerId);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('test-uuid-1234'));
    
    // Verify the result
    expect(result).toEqual({
      message: 'Purchase Order upload initiated',
      id: 'test-uuid-1234',
      status: 'Processing'
    });
  });

  test('should handle file upload error', async () => {
    // Setup test data
    const fileData = {
      buffer: Buffer.from('test file content'),
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };

    // Mock a file upload error
    service.uploadFile.mockRejectedValue(new Error('S3 upload failed'));

    // Call the method and expect it to throw
    await expect(service.uploadPurchaseOrder(fileData)).rejects.toThrow('Failed to upload file to S3');
    
    expect(console.error).toHaveBeenCalled();
    expect(service.purchaseOrderRepository.createInitial).not.toHaveBeenCalled();
  });

  test('should handle purchase order creation error', async () => {
    // Setup test data
    const fileData = {
      buffer: Buffer.from('test file content'),
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };

    // Mock a database error
    service.purchaseOrderRepository.createInitial.mockRejectedValue(new Error('Database error'));

    // Call the method and expect it to throw
    await expect(service.uploadPurchaseOrder(fileData)).rejects.toThrow('Failed to process purchase order');
    
    expect(service.purchaseOrderRepository.updateStatus).toHaveBeenCalledWith('test-uuid-1234', 'Failed');
    expect(console.error).toHaveBeenCalled();
  });

  test('should handle error when purchaseOrderId is not yet defined', async () => {
    // Setup test data
    const fileData = {
      buffer: Buffer.from('test file content'),
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };

    // Mock validation to throw an error before purchaseOrderId is generated
    service.validator.validateFileData.mockImplementation(() => {
      throw new Error('Invalid file format');
    });

    // Call the method and expect it to throw
    await expect(service.uploadPurchaseOrder(fileData)).rejects.toThrow('Failed to process purchase order: Invalid file format');
    
    // Verify the expected behavior
    expect(service.purchaseOrderRepository.updateStatus).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  test('should get purchase order by id', async () => {
    const purchaseOrderId = 'test-order-id';
    const mockPurchaseOrder = { id: purchaseOrderId, status: 'Completed' };
    const mockFormattedResponse = { id: purchaseOrderId, status: 'Completed', formatted: true };
    
    // Setup mocks
    service.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    service.responseFormatter.formatPurchaseOrderResponse.mockReturnValue(mockFormattedResponse);

    // Call the method
    const result = await service.getPurchaseOrderById(purchaseOrderId);

    // Verify the expected behavior
    expect(service.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(service.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(mockPurchaseOrder);
    expect(result).toEqual(mockFormattedResponse);
  });

  test('should handle not found error when getting purchase order', async () => {
    const purchaseOrderId = 'non-existent-id';
    
    // Setup mocks
    service.purchaseOrderRepository.findById.mockResolvedValue(null);

    // Call the method and expect it to throw
    await expect(service.getPurchaseOrderById(purchaseOrderId)).rejects.toThrow('Purchase order not found');
  });

  test('should handle database error when getting purchase order', async () => {
    const purchaseOrderId = 'test-order-id';
    const dbError = new Error('Database connection error');
    
    // Setup mocks
    service.purchaseOrderRepository.findById.mockRejectedValue(dbError);

    // Call the method and expect it to throw
    await expect(service.getPurchaseOrderById(purchaseOrderId)).rejects.toThrow(dbError);
    expect(console.error).toHaveBeenCalled();
  });
});
