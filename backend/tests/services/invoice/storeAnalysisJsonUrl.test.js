const invoiceService = require('../../../src/services/invoice/invoiceService');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');

// Mock repositories
jest.mock('../../../src/repositories/invoiceRepository', () => {
  return jest.fn().mockImplementation(() => ({
    update: jest.fn().mockResolvedValue([1]),
    updateStatus: jest.fn().mockResolvedValue([1])
  }));
});

// Mock other dependencies
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoice/invoiceValidator');
jest.mock('../../../src/services/invoice/invoiceResponseFormatter');
jest.mock('../../../src/services/invoiceMapperService/invoiceMapperService');
jest.mock('../../../src/instrument');
jest.mock('../../../src/services/invoice/invoiceLogger', () => ({
  logProcessingStart: jest.fn(),
  logAnalysisComplete: jest.fn(),
  logDataMappingComplete: jest.fn(),
  logProcessingComplete: jest.fn(),
  logError: jest.fn(),
}));

describe('Invoice Service - Store Analysis JSON URL', () => {
  const mockInvoiceId = 'invoice-123';
  const mockBuffer = Buffer.from('test PDF content');
  const mockPartnerId = 'partner-123';
  const mockOriginalname = 'test-invoice.pdf';
  const mockUuid = 'invoice-uuid-123';
  const mockJsonUrl = 'https://example.com/analysis/invoice-analysis.json';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock analyzeInvoice to return a mock result
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({
      data: {
        fields: {
          invoiceId: { text: 'INV-001' },
          total: { text: '100.00' }
        }
      }
    });
    
    // Mock uploadAnalysisResults to return a mock URL
    invoiceService.uploadAnalysisResults = jest.fn().mockResolvedValue(mockJsonUrl);
    
    // Mock mapAnalysisResult to return mock data
    invoiceService.mapAnalysisResult = jest.fn().mockReturnValue({
      invoiceData: { invoice_number: 'INV-001', total_amount: 100 },
      customerData: { name: 'Test Customer' },
      vendorData: { name: 'Test Vendor' },
      itemsData: [{ description: 'Test Item', amount: 100 }]
    });
    
    // Mock other methods to avoid side effects
    invoiceService.updateCustomerAndVendorData = jest.fn().mockResolvedValue();
    invoiceService.saveInvoiceItems = jest.fn().mockResolvedValue();
  });
  
  /***************
   * POSITIVE CASES
   ***************/
  
  test('[POSITIVE] should store analysis_json_url in the database', async () => {
    // Call the method that processes the invoice
    await invoiceService.processInvoiceAsync(
      mockInvoiceId, mockBuffer, mockPartnerId, mockOriginalname, mockUuid
    );
    
    // Verify that analyzeInvoice was called with the buffer
    expect(invoiceService.analyzeInvoice).toHaveBeenCalledWith(mockBuffer);
    
    // Verify that uploadAnalysisResults was called with the analysis result and invoice ID
    expect(invoiceService.uploadAnalysisResults).toHaveBeenCalled();
    
    // Verify that updateInvoiceRecord was called with the invoice ID and analysis_json_url
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      mockInvoiceId,
      expect.objectContaining({
        analysis_json_url: mockJsonUrl
      })
    );
    
    // Verify that the status was updated to ANALYZED
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      mockInvoiceId, 
      { status: DocumentStatus.ANALYZED }
    );
  });
  
  test('[POSITIVE] should process complete flow with all components working together', async () => {
    // Call the method that processes the invoice
    await invoiceService.processInvoiceAsync(
      mockInvoiceId, mockBuffer, mockPartnerId, mockOriginalname, mockUuid
    );
    
    // Verify the complete processing flow executed correctly
    expect(invoiceService.analyzeInvoice).toHaveBeenCalled();
    expect(invoiceService.uploadAnalysisResults).toHaveBeenCalled();
    expect(invoiceService.mapAnalysisResult).toHaveBeenCalled();
    expect(invoiceService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(invoiceService.saveInvoiceItems).toHaveBeenCalled();
    
    // Verify the final status update occurred
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      expect.anything(),
      { status: DocumentStatus.ANALYZED }
    );
  });
  
  /***************
   * NEGATIVE CASES
   ***************/
  
  test('[NEGATIVE] should handle error and not store URL when analysis fails', async () => {
    // Mock analyzeInvoice to throw an error
    invoiceService.analyzeInvoice = jest.fn().mockRejectedValue(
      new Error('Analysis failed')
    );
    
    // Call the method that processes the invoice
    await invoiceService.processInvoiceAsync(
      mockInvoiceId, mockBuffer, mockPartnerId, mockOriginalname, mockUuid
    );
    
    // Verify that updateInvoiceRecord was not called with analysis_json_url
    expect(invoiceService.invoiceRepository.update).not.toHaveBeenCalled();
    
    // Verify that the status was updated to FAILED
    expect(invoiceService.invoiceRepository.updateStatus).toHaveBeenCalledWith(
      mockInvoiceId, 
      DocumentStatus.FAILED
    );
  });
  
  test('[NEGATIVE] should handle error when S3 upload fails', async () => {
    // Mock uploadAnalysisResults to throw an error
    invoiceService.uploadAnalysisResults = jest.fn().mockRejectedValue(
      new Error('S3 upload failed')
    );
    
    // Call the method that processes the invoice
    await invoiceService.processInvoiceAsync(
      mockInvoiceId, mockBuffer, mockPartnerId, mockOriginalname, mockUuid
    );
    
    // Verify that updateInvoiceRecord was not called
    expect(invoiceService.invoiceRepository.update).not.toHaveBeenCalled();
    
    // Verify that the status was updated to FAILED
    expect(invoiceService.invoiceRepository.updateStatus).toHaveBeenCalledWith(
      mockInvoiceId, 
      DocumentStatus.FAILED
    );
  });
  
  /***************
   * CORNER CASES
   ***************/
   
  test('[CORNER] should handle empty analysis result but still store URL', async () => {
    // Mock analyzeInvoice to return an empty result
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({ data: {} });
    
    // Call the method that processes the invoice
    await invoiceService.processInvoiceAsync(
      mockInvoiceId, mockBuffer, mockPartnerId, mockOriginalname, mockUuid
    );
    
    // Verify that updateInvoiceRecord was still called with analysis_json_url
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        analysis_json_url: mockJsonUrl
      })
    );
  });
  
  test('[CORNER] should handle malformed data from mapping but still store analysis URL', async () => {
    // Mock mapAnalysisResult to return null data
    invoiceService.mapAnalysisResult = jest.fn().mockReturnValue({
      invoiceData: null, 
      customerData: null, 
      vendorData: null, 
      itemsData: null
    });
    
    // Call the method that processes the invoice
    await invoiceService.processInvoiceAsync(
      mockInvoiceId, mockBuffer, mockPartnerId, mockOriginalname, mockUuid
    );
    
    // Verify that updateInvoiceRecord was still called with analysis_json_url
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        analysis_json_url: mockJsonUrl
      })
    );
    
    // The process should still complete successfully
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      expect.anything(),
      { status: DocumentStatus.ANALYZED }
    );
  });
});