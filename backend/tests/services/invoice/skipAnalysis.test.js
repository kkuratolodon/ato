const invoiceService = require('../../../src/services/invoice/invoiceService');
const Sentry = require('../../../src/instrument');

// Mocks
jest.mock('../../../src/instrument', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn()
}));

// Mock required components
jest.mock('../../../src/repositories/invoiceRepository');
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoice/invoiceValidator');

describe('InvoiceService - Skip Analysis Functionality', () => {
  const mockBuffer = Buffer.from('test data');
  const mockPartnerId = 'partner-123';
  const mockOriginalname = 'test.pdf';
  const mockInvoiceId = 'invoice-123';
  const mockUuid = 'test-uuid-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock methods for test
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({ data: 'azure-analysis-data' });
    invoiceService.loadSampleData = jest.fn().mockResolvedValue({ data: 'sample-data' });
    invoiceService.uploadAnalysisResults = jest.fn().mockResolvedValue('https://example.com/analysis.json');
    invoiceService.mapAnalysisResult = jest.fn().mockReturnValue({
      invoiceData: { invoice_number: 'INV-001' },
      customerData: { name: 'Test Customer' },
      vendorData: { name: 'Test Vendor' },
      itemsData: [{ description: 'Item 1' }]
    });
    
    invoiceService.updateInvoiceRecord = jest.fn().mockResolvedValue();
    invoiceService.updateCustomerAndVendorData = jest.fn().mockResolvedValue();
    invoiceService.saveInvoiceItems = jest.fn().mockResolvedValue();
    invoiceService.invoiceRepository.update = jest.fn().mockResolvedValue();
    invoiceService.invoiceRepository.updateStatus = jest.fn().mockResolvedValue();
    
    // Mock all required logger methods
    invoiceService.logger = {
      logProcessingStart: jest.fn(),
      logAnalysisComplete: jest.fn(),
      logDataMappingComplete: jest.fn(),
      logProcessingComplete: jest.fn(),
      logError: jest.fn(),
      logUploadStart: jest.fn(),    // Add this method
      logUploadSuccess: jest.fn(),  // Add this method
      logValidationError: jest.fn() // Add for completeness
    };
  });

  describe('processInvoiceAsync with skipAnalysis parameter', () => {
    test('should use sample data when skipAnalysis is true', async () => {
      // Act
      await invoiceService.processInvoiceAsync(
        mockInvoiceId, mockBuffer, mockPartnerId, mockOriginalname, mockUuid, true
      );
      
      // Assert
      expect(invoiceService.loadSampleData).toHaveBeenCalled();
      expect(invoiceService.analyzeInvoice).not.toHaveBeenCalled();
      expect(invoiceService.logger.logAnalysisComplete).toHaveBeenCalledWith(mockInvoiceId, "Using sample data");
      
      // Should still perform the rest of the processing
      expect(invoiceService.uploadAnalysisResults).toHaveBeenCalled();
      expect(invoiceService.mapAnalysisResult).toHaveBeenCalledWith(
        { data: 'sample-data' }, 
        mockPartnerId, 
        mockOriginalname, 
        mockBuffer.length
      );
    });
    
    test('should use Azure analysis when skipAnalysis is false', async () => {
      // Act
      await invoiceService.processInvoiceAsync(
        mockInvoiceId, mockBuffer, mockPartnerId, mockOriginalname, mockUuid, false
      );
      
      // Assert
      expect(invoiceService.loadSampleData).not.toHaveBeenCalled();
      expect(invoiceService.analyzeInvoice).toHaveBeenCalledWith(mockBuffer);
      expect(invoiceService.logger.logAnalysisComplete).toHaveBeenCalledWith(
        mockInvoiceId, 
        "https://example.com/analysis.json"
      );
      
      // Verify mappings uses Azure data
      expect(invoiceService.mapAnalysisResult).toHaveBeenCalledWith(
        { data: 'azure-analysis-data' }, 
        mockPartnerId, 
        mockOriginalname, 
        mockBuffer.length
      );
    });

    test('should handle errors when loading sample data', async () => {
      // Arrange
      const mockError = new Error('Failed to load sample data');
      invoiceService.loadSampleData.mockRejectedValue(mockError);
      
      // Act
      await invoiceService.processInvoiceAsync(
        mockInvoiceId, mockBuffer, mockPartnerId, mockOriginalname, mockUuid, true
      );
      
      // Assert
      expect(invoiceService.loadSampleData).toHaveBeenCalled();
      expect(invoiceService.logger.logError).toHaveBeenCalledWith(mockInvoiceId, mockError, 'PROCESSING');
      expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
      expect(invoiceService.invoiceRepository.updateStatus).toHaveBeenCalledWith(mockInvoiceId, 'Failed');
    });
  });

  // Add tests for uploadInvoice with skipAnalysis parameter
  describe('uploadInvoice with skipAnalysis parameter', () => {
    beforeEach(() => {
      // Additional mocks needed for uploadInvoice tests
      invoiceService.validator.validateFileData = jest.fn();
      invoiceService.uploadFile = jest.fn().mockResolvedValue({ file_url: 'https://example.com/file.pdf' });
      invoiceService.invoiceRepository.createInitial = jest.fn().mockResolvedValue({});
      
      // We need to mock processInvoiceAsync independently for these tests
      const originalProcessInvoiceAsync = invoiceService.processInvoiceAsync;
      invoiceService.processInvoiceAsync = jest.fn();
      
      // Store original to restore after tests
      this.originalProcessInvoiceAsync = originalProcessInvoiceAsync;
    });
    
    afterEach(() => {
      // Restore original method if we saved it
      if (this.originalProcessInvoiceAsync) {
        invoiceService.processInvoiceAsync = this.originalProcessInvoiceAsync;
      }
    });
    
    test('should pass skipAnalysis=true to processInvoiceAsync when specified', async () => {
      // Arrange
      const fileData = {
        buffer: mockBuffer, 
        partnerId: mockPartnerId, 
        originalname: mockOriginalname
      };
      
      // Act
      await invoiceService.uploadInvoice(fileData, true);
      
      // Assert - verify the skipAnalysis parameter was passed
      expect(invoiceService.processInvoiceAsync).toHaveBeenCalledWith(
        expect.any(String), // invoiceId
        mockBuffer,
        mockPartnerId,
        mockOriginalname,
        expect.any(String), // uuid
        true // skipAnalysis should be true
      );
    });
    
    test('should default skipAnalysis to false when not specified', async () => {
      // Arrange
      const fileData = {
        buffer: mockBuffer, 
        partnerId: mockPartnerId, 
        originalname: mockOriginalname
      };
      
      // Act
      await invoiceService.uploadInvoice(fileData);
      
      // Assert - verify the default value was used
      expect(invoiceService.processInvoiceAsync).toHaveBeenCalledWith(
        expect.any(String), // invoiceId
        mockBuffer,
        mockPartnerId,
        mockOriginalname,
        expect.any(String), // uuid
        false // skipAnalysis should default to false
      );
    });
  });
});
