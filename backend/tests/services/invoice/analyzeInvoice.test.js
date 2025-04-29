const InvoiceService = require('@services/invoice/invoiceService');
const AzureDocumentAnalyzer = require('@services/analysis/azureDocumentAnalyzer');

// Mock the AzureDocumentAnalyzer
jest.mock('@services/analysis/azureDocumentAnalyzer', () => {
  return jest.fn().mockImplementation(() => {
    return {
      analyzeDocument: jest.fn()
    };
  });
});

describe('InvoiceService - analyzeInvoice', () => {
  let documentAnalyzerMock;

  beforeEach(() => {
    documentAnalyzerMock = new AzureDocumentAnalyzer();
    InvoiceService.documentAnalyzer = documentAnalyzerMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call analyzeDocument with correct documentUrl', async () => {
    const mockUrl = 'https://example.com/document.pdf';
    documentAnalyzerMock.analyzeDocument.mockResolvedValue({ data: 'mocked analysis result' });

    const result = await InvoiceService.analyzeInvoice(mockUrl);

    expect(documentAnalyzerMock.analyzeDocument).toHaveBeenCalledWith(mockUrl);
    expect(result).toEqual({ data: 'mocked analysis result' });
  });

  it('should throw an error if analyzeDocument fails', async () => {
    const mockUrl = 'https://example.com/document.pdf';
    documentAnalyzerMock.analyzeDocument.mockRejectedValue(new Error('Analysis failed'));

    await expect(InvoiceService.analyzeInvoice(mockUrl)).rejects.toThrow('Analysis failed');
  });
});