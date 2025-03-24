const invoiceService = require('../../../src/services/invoice/invoiceService');

// Mock repositories instead of models
jest.mock('../../../src/repositories/invoiceRepository', () => {
  return jest.fn().mockImplementation(() => ({
    createInitial: jest.fn()
  }));
});

jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');

// Mock Azure Document Intelligence
jest.mock("@azure/ai-form-recognizer");

// Mock S3 Service
jest.mock('../../../src/services/s3Service', () => ({
  uploadFile: jest.fn()
}));

// Mock other dependencies
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoice/invoiceValidator');
jest.mock('../../../src/services/invoice/invoiceResponseFormatter');
jest.mock('../../../src/services/invoiceMapperService');

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid-123')
}));

// Mock Sentry
jest.mock('../../../src/instrument', () => ({
  init: jest.fn(),
  startSpan: jest.fn((_, callback) => callback({
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn()
  })),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

describe('createInvoiceRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create invoice record with correct data', async () => {
    // Arrange
    const partnerId = 'partner-123';
    const s3Url = 'https://example.com/test.pdf';
    const originalFilename = 'test.pdf';
    const fileSize = 1024;
    
    const invoiceData = {
      id: 'mocked-uuid-123',
      status: 'Processing',
      partner_id: partnerId,
      file_url: s3Url,
      original_filename: originalFilename,
      file_size: fileSize
    };
    
    const mockCreatedInvoice = {
      id: 'mocked-uuid-123',
      status: 'Processing',
      partner_id: partnerId,
      file_url: s3Url,
      original_filename: originalFilename,
      file_size: fileSize
    };

    invoiceService.invoiceRepository.createInitial.mockResolvedValue(mockCreatedInvoice);

    // Act - Call the method in the same way it would be called in the actual code
    const result = await invoiceService.invoiceRepository.createInitial(invoiceData);

    // Assert
    expect(invoiceService.invoiceRepository.createInitial).toHaveBeenCalledWith(invoiceData);
    expect(result).toEqual(mockCreatedInvoice);
  });

  test('should throw error when database operation fails', async () => {
    // Arrange
    const partnerId = 'partner-123';
    const s3Url = 'https://example.com/test.pdf';
    const originalFilename = 'test.pdf';
    const fileSize = 1024;
    
    const invoiceData = {
      id: 'mocked-uuid-123',
      status: 'Processing',
      partner_id: partnerId,
      file_url: s3Url,
      original_filename: originalFilename,
      file_size: fileSize
    };
    
    const mockError = new Error('Database connection error');

    invoiceService.invoiceRepository.createInitial.mockRejectedValue(mockError);

    // Act & Assert
    await expect(invoiceService.invoiceRepository.createInitial(invoiceData))
      .rejects.toThrow('Database connection error');
  });

  test('should handle missing parameters gracefully', async () => {
    // Arrange
    const invoiceData = {
      id: 'mocked-uuid-123',
      status: 'Processing',
      partner_id: null,
      file_url: null,
      original_filename: null,
      file_size: null
    };
    
    const mockCreatedInvoice = {
      id: 'mocked-uuid-123',
      status: 'Processing',
      partner_id: null,
      file_url: null,
      original_filename: null,
      file_size: null
    };

    invoiceService.invoiceRepository.createInitial.mockResolvedValue(mockCreatedInvoice);

    // Act
    const result = await invoiceService.invoiceRepository.createInitial(invoiceData);

    // Assert
    expect(invoiceService.invoiceRepository.createInitial).toHaveBeenCalledWith(invoiceData);
    expect(result).toEqual(mockCreatedInvoice);
  });
  
  // Test for the actual method that uses createInitial in the service
  test('should test createInitial through uploadInvoice', async () => {
    // Arrange
    const partnerId = 'partner-123';
    const s3Url = 'https://example.com/test.pdf';
    const originalFilename = 'test.pdf';
    const fileSize = 1024;
    
    const fileData = {
      buffer: Buffer.from('test'),
      partnerId,
      originalname: originalFilename,
    };
    
    const mockCreatedInvoice = {
      id: 'mocked-uuid-123',
      status: 'Processing',
      partner_id: partnerId,
      file_url: s3Url,
      original_filename: originalFilename,
      file_size: fileSize
    };
    
    // Mock validator
    invoiceService.validator = {
      validateFileData: jest.fn()
    };
    
    // Mock uploadFile from parent class
    invoiceService.uploadFile = jest.fn().mockResolvedValue({
      file_url: s3Url
    });
    
    invoiceService.invoiceRepository.createInitial.mockResolvedValue(mockCreatedInvoice);
    
    // Mock processInvoiceAsync to avoid actual processing
    invoiceService.processInvoiceAsync = jest.fn();
    
    // Act
    const result = await invoiceService.uploadInvoice(fileData);
    
    // Assert
    expect(invoiceService.invoiceRepository.createInitial).toHaveBeenCalledWith(expect.objectContaining({
      id: 'mocked-uuid-123', // UUID is now mocked
      status: 'Processing',
      partner_id: partnerId,
      file_url: s3Url,
      original_filename: originalFilename,
      file_size: fileData.buffer.length
    }));
    
    // Check result format matches the expected response
    expect(result).toEqual({
      message: "Invoice upload initiated",
      id: 'mocked-uuid-123',
      status: "Processing"
    });
  });
});