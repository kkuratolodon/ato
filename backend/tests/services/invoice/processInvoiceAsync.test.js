const Sentry = require('../../../src/instrument');
const InvoiceService = require('../../../src/services/invoice/invoiceService');

// Save original reference and restore after tests
const originalProcessInvoiceAsync = InvoiceService.processInvoiceAsync;

// Mock dependencies
jest.mock('../../../src/instrument', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn()
}));

jest.mock('../../../src/repositories/invoiceRepository');
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoiceMapperService/invoiceMapperService');

describe('InvoiceService.processInvoiceAsync direct implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the internal methods of InvoiceService
    InvoiceService.documentAnalyzer = {
      analyzeDocument: jest.fn().mockResolvedValue({ data: 'test data' })
    };
    
    InvoiceService.mapAnalysisResult = jest.fn().mockReturnValue({
      invoiceData: { invoice_number: 'INV-001' },
      customerData: { name: 'Test Customer' },
      vendorData: { name: 'Test Vendor' },
      itemsData: [{ description: 'Test Item' }]
    });
    
    InvoiceService.updateInvoiceRecord = jest.fn().mockResolvedValue();
    InvoiceService.updateCustomerAndVendorData = jest.fn().mockResolvedValue();
    InvoiceService.saveInvoiceItems = jest.fn().mockResolvedValue();
    
    InvoiceService.invoiceRepository = {
      updateStatus: jest.fn().mockResolvedValue()
    };
    
    // Mock console to avoid cluttering test output
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });
  
  afterAll(() => {
    // Restore the original method
    InvoiceService.processInvoiceAsync = originalProcessInvoiceAsync;
  });

  test('should process invoice successfully', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'test-uuid-123';

    // Act
    await originalProcessInvoiceAsync.call(InvoiceService, invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "invoiceProcessing",
      message: `Starting async processing for invoice ${uuid}`,
      level: "info"
    });
    
    expect(InvoiceService.documentAnalyzer.analyzeDocument).toHaveBeenCalledWith(buffer);
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalledWith(
      { data: 'test data' }, partnerId, originalname, buffer.length
    );
    
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalledWith(
      invoiceId, { invoice_number: 'INV-001' }
    );
    expect(InvoiceService.updateCustomerAndVendorData).toHaveBeenCalledWith(
      invoiceId, { name: 'Test Customer' }, { name: 'Test Vendor' }
    );
    expect(InvoiceService.saveInvoiceItems).toHaveBeenCalledWith(
      invoiceId, [{ description: 'Test Item' }]
    );
    
    expect(InvoiceService.invoiceRepository.updateStatus).toHaveBeenCalledWith(
      invoiceId, 'Analyzed'
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      `Successfully completed processing invoice ${uuid}`
    );
  });

  test('should handle error during document analysis', async () => {
    // Arrange
    const invoiceId = 'error-invoice-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Analysis error');
    InvoiceService.documentAnalyzer.analyzeDocument.mockRejectedValue(error);

    // Act
    await originalProcessInvoiceAsync.call(InvoiceService, invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(InvoiceService.documentAnalyzer.analyzeDocument).toHaveBeenCalledWith(buffer);
    expect(InvoiceService.mapAnalysisResult).not.toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
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
    await originalProcessInvoiceAsync.call(InvoiceService, invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.documentAnalyzer.analyzeDocument).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
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
    await originalProcessInvoiceAsync.call(InvoiceService, invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.documentAnalyzer.analyzeDocument).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalled();
    expect(InvoiceService.updateCustomerAndVendorData).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
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
    await originalProcessInvoiceAsync.call(InvoiceService, invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.documentAnalyzer.analyzeDocument).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalled();
    expect(InvoiceService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(InvoiceService.saveInvoiceItems).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
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
    await originalProcessInvoiceAsync.call(InvoiceService, invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.documentAnalyzer.analyzeDocument).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalled();
    expect(InvoiceService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(InvoiceService.saveInvoiceItems).toHaveBeenCalled();
    expect(InvoiceService.invoiceRepository.updateStatus).not.toHaveBeenCalledWith(invoiceId, 'Analyzed');
    expect(console.error).toHaveBeenCalled();
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
    InvoiceService.invoiceRepository.updateStatus.mockImplementation((id, status) => {
      if (status === 'Analyzed') {
        return Promise.reject(error);
      }
      return Promise.resolve();
    });

    // Act
    await originalProcessInvoiceAsync.call(InvoiceService, invoiceId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(InvoiceService.documentAnalyzer.analyzeDocument).toHaveBeenCalled();
    expect(InvoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(InvoiceService.updateInvoiceRecord).toHaveBeenCalled();
    expect(InvoiceService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(InvoiceService.saveInvoiceItems).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});