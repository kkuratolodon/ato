const PurchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');
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
    
    // Mock the implementation of processPurchaseOrderAsync for tests
    service.processPurchaseOrderAsync = jest.fn();
    
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
    // Mock all required parameters for processPurchaseOrderAsync
    const purchaseOrderId = 'mock-id';
    const mockBuffer = Buffer.from('test');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'mock-id';
    
    service.processPurchaseOrderAsync = originalProcessAsync; // Use real implementation for this test

    // Create an error that will be thrown inside the method
    const testError = new Error('Processing error');
    service.analyzeDocument = jest.fn().mockRejectedValue(testError);
    
    // Make sure updateStatus doesn't throw errors
    service.purchaseOrderRepository.updateStatus = jest.fn().mockResolvedValue();

    // Call the actual method, which should catch the error
    await service.processPurchaseOrderAsync(purchaseOrderId, mockBuffer, partnerId, originalname, uuid);

    // Verify error handling
    expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    // Only checking that updateStatus was called with 'Failed' status
    expect(service.purchaseOrderRepository.updateStatus).toHaveBeenCalledWith(purchaseOrderId, 'Failed');
    expect(console.error).toHaveBeenCalled();
  });

  test('should successfully process purchase order async', async () => {
    const purchaseOrderId = 'mock-id';
    // Mock needed dependencies to allow successful processing with the implementation
    service.analyzeDocument = jest.fn().mockResolvedValue({ data: {} });
    service.uploadAnalysisResults = jest.fn().mockResolvedValue('https://example.com/analysis.json');
    service.mapAnalysisResult = jest.fn().mockReturnValue({ 
      purchaseOrderData: {}, 
      customerData: {}, 
      vendorData: {}, 
      itemsData: [] 
    });
    service.updatePurchaseOrderRecord = jest.fn().mockResolvedValue();
    service.updateCustomerAndVendorData = jest.fn().mockResolvedValue();
    service.saveInvoiceItems = jest.fn().mockResolvedValue();

    // Reset updateStatus mock to avoid previous test's implementation
    service.purchaseOrderRepository.updateStatus = jest.fn().mockResolvedValue();

    // Use the real implementation for this test
    service.processPurchaseOrderAsync = originalProcessAsync;

    // Call the method with required parameters
    const mockBuffer = Buffer.from('test');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';

    // Call the method
    await service.processPurchaseOrderAsync(purchaseOrderId, mockBuffer, partnerId, originalname, purchaseOrderId);

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
    expect(service.processPurchaseOrderAsync).toHaveBeenCalledWith(
      'test-uuid-1234', 
      fileData.buffer, 
      'partner-123', 
      'test.pdf', 
      'test-uuid-1234'
    );
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
    const mockItems = [];
    const mockCustomer = null;
    const mockVendor = null;
    
    // Setup mocks
    service.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    service.getItems = jest.fn().mockResolvedValue(mockItems);
    service.getCustomer = jest.fn().mockResolvedValue(mockCustomer);
    service.getVendor = jest.fn().mockResolvedValue(mockVendor);
    service.responseFormatter.formatPurchaseOrderResponse.mockReturnValue(mockFormattedResponse);

    // Call the method
    const result = await service.getPurchaseOrderById(purchaseOrderId);

    // Verify the expected behavior
    expect(service.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(service.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(
      mockPurchaseOrder, 
      mockItems, 
      mockCustomer, 
      mockVendor
    );
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
