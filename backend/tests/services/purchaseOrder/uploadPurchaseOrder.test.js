const DocumentStatus = require('../../../src/models/enums/DocumentStatus');
const purchaseOrderService = require('@services/purchaseOrder/purchaseOrderService');

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-1234')
}));

// Mock dependencies
jest.mock('@repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    createInitial: jest.fn(),
    findById: jest.fn()
  }));
});

jest.mock('@repositories/customerRepository');
jest.mock('@repositories/vendorRepository');
jest.mock('@repositories/itemRepository');
jest.mock('@services/purchaseOrder/purchaseOrderValidator');
jest.mock('@services/purchaseOrder/purchaseOrderResponseFormatter');
jest.mock('@services/analysis/azureDocumentAnalyzer');
jest.mock('@services/purchaseOrderMapperService/purchaseOrderMapperService');

// Mock Sentry
jest.mock('../../../src/instrument');

describe('uploadPurchaseOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mocks for successful upload
    purchaseOrderService.validator.validateFileData = jest.fn();
    purchaseOrderService.uploadFile = jest.fn().mockResolvedValue({ 
      file_url: 'https://example.com/file.pdf'
    });
    purchaseOrderService.purchaseOrderRepository.createInitial = jest.fn().mockResolvedValue();
    purchaseOrderService.processPurchaseOrderAsync = jest.fn();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });
  
  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('should successfully upload purchase order and initiate processing', async () => {
    // Arrange
    const fileData = {
      buffer: Buffer.from('test file content'),
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };

    // Act
    const result = await purchaseOrderService.uploadPurchaseOrder(fileData);

    // Assert
    expect(purchaseOrderService.validator.validateFileData).toHaveBeenCalledWith(fileData);
    expect(purchaseOrderService.uploadFile).toHaveBeenCalledWith(fileData);
    expect(purchaseOrderService.purchaseOrderRepository.createInitial).toHaveBeenCalledWith({
      id: 'test-uuid-1234',
      status: DocumentStatus.PROCESSING,
      partner_id: 'partner-123',
      file_url: 'https://example.com/file.pdf',
      original_filename: 'test.pdf',
      file_size: fileData.buffer.length,
    });
    expect(purchaseOrderService.processPurchaseOrderAsync).toHaveBeenCalledWith(
      'test-uuid-1234', 
      fileData.buffer, 
      'partner-123', 
      'test.pdf', 
      'test-uuid-1234'
    );
    
    expect(result).toEqual({
      message: 'Purchase Order upload initiated',
      id: 'test-uuid-1234',
      status: DocumentStatus.PROCESSING
    });
  });

  test('should handle validation errors', async () => {
    // Arrange
    const fileData = {
      buffer: Buffer.from(''),
      originalname: 'invalid.xyz',
      partnerId: 'partner-123'
    };
    
    const validationError = new Error('Invalid file format');
    purchaseOrderService.validator.validateFileData.mockImplementation(() => {
      throw validationError;
    });

    // Act & Assert
    await expect(purchaseOrderService.uploadPurchaseOrder(fileData))
      .rejects.toThrow('Failed to process purchase order: Invalid file format');
    
    expect(purchaseOrderService.validator.validateFileData).toHaveBeenCalled();
    expect(purchaseOrderService.uploadFile).not.toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.createInitial).not.toHaveBeenCalled();
    expect(purchaseOrderService.processPurchaseOrderAsync).not.toHaveBeenCalled();
  });

  test('should handle S3 upload errors', async () => {
    // Arrange
    const fileData = {
      buffer: Buffer.from('test file content'),
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };
    
    const s3Error = new Error('S3 upload failed');
    purchaseOrderService.uploadFile.mockRejectedValue(s3Error);

    // Act & Assert
    await expect(purchaseOrderService.uploadPurchaseOrder(fileData))
      .rejects.toThrow('Failed to upload file to S3');
    
    expect(purchaseOrderService.validator.validateFileData).toHaveBeenCalled();
    expect(purchaseOrderService.uploadFile).toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.createInitial).not.toHaveBeenCalled();
    expect(purchaseOrderService.processPurchaseOrderAsync).not.toHaveBeenCalled();
  });

  test('should handle database errors during initial creation', async () => {
    // Arrange
    const fileData = {
      buffer: Buffer.from('test file content'),
      originalname: 'test.pdf',
      partnerId: 'partner-123'
    };
    
    const dbError = new Error('Database error');
    purchaseOrderService.purchaseOrderRepository.createInitial.mockRejectedValue(dbError);

    // Act & Assert
    await expect(purchaseOrderService.uploadPurchaseOrder(fileData))
      .rejects.toThrow('Failed to process purchase order');
    
    expect(purchaseOrderService.validator.validateFileData).toHaveBeenCalled();
    expect(purchaseOrderService.uploadFile).toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.createInitial).toHaveBeenCalled();
    expect(purchaseOrderService.processPurchaseOrderAsync).not.toHaveBeenCalled();
  });

  test('should use provided file size from buffer', async () => {
    // Arrange
    const fileData = {
      buffer: Buffer.from('large file content simulated'),
      originalname: 'large_document.pdf',
      partnerId: 'partner-123'
    };

    // Act
    await purchaseOrderService.uploadPurchaseOrder(fileData);

    // Assert
    expect(purchaseOrderService.purchaseOrderRepository.createInitial).toHaveBeenCalledWith(
      expect.objectContaining({
        file_size: fileData.buffer.length
      })
    );
  });
});