const Sentry = require('../../../src/instrument');
const DocumentStatus = require('../../../src/models/enums/documentStatus');
const InvoiceService = require('../../../src/services/invoice/invoiceService');

// Mock dependencies
jest.mock('../../../src/instrument', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn()
}));

// Mock the InvoiceLogger
jest.mock('../../../src/services/invoice/invoiceLogger', () => ({
  logUploadStart: jest.fn(),
  logUploadSuccess: jest.fn(),
  logProcessingStart: jest.fn(),
  logAnalysisComplete: jest.fn(),
  logDataMappingComplete: jest.fn(),
  logProcessingComplete: jest.fn(),
  logError: jest.fn(),
  logValidationError: jest.fn()
}));

jest.mock('../../../src/repositories/invoiceRepository');
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoiceMapperService/invoiceMapperService');

// Import the mocked logger
const InvoiceLogger = require('../../../src/services/invoice/invoiceLogger');

describe('InvoiceService.processInvoiceAsync direct implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock methods directly on the InvoiceService singleton
    InvoiceService.analyzeInvoice = jest.fn().mockResolvedValue({ data: 'test data' });
    InvoiceService.uploadAnalysisResults = jest.fn().mockResolvedValue('https://example.com/analysis.json');
    InvoiceService.mapAnalysisResult = jest.fn().mockReturnValue({
      invoiceData: { invoice_number: 'INV-001' },
      customerData: { name: 'Test Customer' },
      vendorData: { name: 'Test Vendor' },
      itemsData: [{ description: 'Test Item' }]
    });
    
    InvoiceService.updateInvoiceRecord = jest.fn().mockResolvedValue();
    InvoiceService.updateCustomerAndVendorData = jest.fn().mockResolvedValue();
    InvoiceService.saveInvoiceItems = jest.fn().mockResolvedValue();
    
    // Mock directly on repository instances
    InvoiceService.invoiceRepository.update = jest.fn().mockResolvedValue();
    InvoiceService.invoiceRepository.updateStatus = jest.fn().mockResolvedValue();
    
    // Mock console to avoid cluttering test output
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });

  test('should process invoice successfully', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'test-uuid-123';

    // Act
    await InvoiceService.processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "invoiceProcessing",
      message: `Starting async processing for invoice ${uuid}`,
      level: "info"
    });
    
    expect(InvoiceService.analyzeInvoice).toHaveBeenCalledWith(buffer);
    expect(InvoiceService.uploadAnalysisResults).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalledWith(
      { data: 'test data' }, partnerId, originalname, buffer.length
    );
    
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalledWith(
      invoiceId, 
      { 
        invoice_number: 'INV-001',
        analysis_json_url: 'https://example.com/analysis.json'
      }
    );
    expect(InvoiceService.updateCustomerAndVendorData).toHaveBeenCalledWith(
      invoiceId, { name: 'Test Customer' }, { name: 'Test Vendor' }
    );
    expect(InvoiceService.saveInvoiceItems).toHaveBeenCalledWith(
      invoiceId, [{ description: 'Test Item' }]
    );
    
    expect(InvoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      invoiceId, { status: DocumentStatus.ANALYZED }
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      `Successfully completed processing invoice ${uuid}`
    );
    
    // Verify logger calls
    expect(InvoiceLogger.logProcessingStart).toHaveBeenCalledWith(invoiceId);
    expect(InvoiceLogger.logAnalysisComplete).toHaveBeenCalledWith(invoiceId, 'https://example.com/analysis.json');
    expect(InvoiceLogger.logDataMappingComplete).toHaveBeenCalledWith(invoiceId, {
      hasCustomerData: true,
      hasVendorData: true,
      itemsCount: 1
    });
    expect(InvoiceLogger.logProcessingComplete).toHaveBeenCalledWith(invoiceId);
  });

  test('should handle error during document analysis', async () => {
    // Arrange
    const invoiceId = 'error-invoice-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Analysis error');
    InvoiceService.analyzeInvoice.mockRejectedValue(error);

    // Act
    await InvoiceService.processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(InvoiceService.analyzeInvoice).toHaveBeenCalledWith(buffer);
    expect(InvoiceService.mapAnalysisResult).not.toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).not.toHaveBeenCalled();
    expect(InvoiceLogger.logError).toHaveBeenCalledWith(invoiceId, error, 'PROCESSING');
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(InvoiceService.invoiceRepository.updateStatus).toHaveBeenCalledWith(invoiceId, 'Failed');
  });

  test('should handle error during mapAnalysisResult', async () => {
    // Arrange
    const invoiceId = 'error-invoice-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Mapping error');
    InvoiceService.mapAnalysisResult.mockImplementation(() => {
      throw error;
    });

    // Act
    await InvoiceService.processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.analyzeInvoice).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).not.toHaveBeenCalled();
    expect(InvoiceLogger.logError).toHaveBeenCalledWith(invoiceId, error, 'PROCESSING');
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(InvoiceService.invoiceRepository.updateStatus).toHaveBeenCalledWith(invoiceId, 'Failed');
  });

  test('should handle error during updateInvoiceRecord', async () => {
    // Arrange
    const invoiceId = 'error-invoice-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Update error');
    InvoiceService.updateInvoiceRecord.mockRejectedValue(error);

    // Act
    await InvoiceService.processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.analyzeInvoice).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalled();
    expect(InvoiceService.updateCustomerAndVendorData).not.toHaveBeenCalled();
    expect(InvoiceLogger.logError).toHaveBeenCalledWith(invoiceId, error, 'PROCESSING');
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(InvoiceService.invoiceRepository.updateStatus).toHaveBeenCalledWith(invoiceId, 'Failed');
  });

  test('should handle error during updateCustomerAndVendorData', async () => {
    // Arrange
    const invoiceId = 'error-invoice-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Customer/Vendor error');
    InvoiceService.updateCustomerAndVendorData.mockRejectedValue(error);

    // Act
    await InvoiceService.processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.analyzeInvoice).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalled();
    expect(InvoiceService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(InvoiceService.saveInvoiceItems).not.toHaveBeenCalled();
    expect(InvoiceLogger.logError).toHaveBeenCalledWith(invoiceId, error, 'PROCESSING');
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(InvoiceService.invoiceRepository.updateStatus).toHaveBeenCalledWith(invoiceId, 'Failed');
  });

  test('should handle error during saveInvoiceItems', async () => {
    // Arrange
    const invoiceId = 'error-invoice-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Items error');
    InvoiceService.saveInvoiceItems.mockRejectedValue(error);

    // Act
    await InvoiceService.processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.analyzeInvoice).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalled();
    expect(InvoiceService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(InvoiceService.saveInvoiceItems).toHaveBeenCalled();
    expect(InvoiceLogger.logError).toHaveBeenCalledWith(invoiceId, error, 'PROCESSING');
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(InvoiceService.invoiceRepository.updateStatus).toHaveBeenCalledWith(invoiceId, 'Failed');
  });

  test('should handle error during final status update', async () => {
    // Arrange
    const invoiceId = 'error-invoice-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Status update error');
    InvoiceService.invoiceRepository.update.mockImplementation((id, status) => {
      if (status && status.status === 'Analyzed') {
        return Promise.reject(error);
      }
      return Promise.resolve();
    });

    // Act
    await InvoiceService.processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.analyzeInvoice).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalled();
    expect(InvoiceService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(InvoiceService.saveInvoiceItems).toHaveBeenCalled();
    expect(InvoiceLogger.logError).toHaveBeenCalledWith(invoiceId, error, 'PROCESSING');
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});