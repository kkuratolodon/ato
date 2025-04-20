const InvoiceService = require('@services/invoice/invoiceService');

// Mock the repository methods instead of models
jest.mock('@repositories/invoiceRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findById: jest.fn()
  }));
});

// Other mocks needed for InvoiceService to initialize properly
jest.mock('@repositories/customerRepository');
jest.mock('@repositories/vendorRepository');
jest.mock('@repositories/itemRepository');
jest.mock('@services/analysis/azureDocumentAnalyzer');
jest.mock('@services/invoice/invoiceValidator');
jest.mock('@services/invoice/invoiceResponseFormatter');
jest.mock('@services/invoiceMapperService/invoiceMapperService');

// Sentry mock
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

describe("getPartnerId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Should return partner_id when given a valid invoice ID", async () => {
    // Mock the repository response for a successful lookup
    const mockInvoice = {
      id: "invoice-123",
      partner_id: "partner-123"
    };
    
    // Set up the mock to return our test invoice
    InvoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);

    // Call the method being tested
    const result = await InvoiceService.getPartnerId("invoice-123");

    // Assertions
    expect(result).toBe("partner-123");
    expect(InvoiceService.invoiceRepository.findById).toHaveBeenCalledWith("invoice-123");
  });

  test("Should throw an error when invoice is not found", async () => {
    // Mock the repository to return null (invoice not found)
    InvoiceService.invoiceRepository.findById.mockResolvedValue(null);

    // Test that calling the method throws the expected error
    await expect(InvoiceService.getPartnerId("nonexistent-invoice"))
      .rejects.toThrow("Invoice not found");
      
    expect(InvoiceService.invoiceRepository.findById).toHaveBeenCalledWith("nonexistent-invoice");
  });

  test("Should throw an error when database fails", async () => {
    // Mock the repository to throw an error
    const dbError = new Error("Database error");
    InvoiceService.invoiceRepository.findById.mockRejectedValue(dbError);

    // Test that the error is properly propagated
    await expect(InvoiceService.getPartnerId("invoice-123"))
      .rejects.toThrow("Database error");
      
    expect(InvoiceService.invoiceRepository.findById).toHaveBeenCalledWith("invoice-123");
  });
});