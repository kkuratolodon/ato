const invoiceService = require('../../src/services/invoiceService');
const s3Service = require('../../src/services/s3Service');
const { Invoice } = require('../../src/models')
const fs = require("fs");
const path = require("path");
const { DocumentAnalysisClient } = require("@azure/ai-form-recognizer");

jest.mock("@azure/ai-form-recognizer");

jest.mock('../../src/services/s3Service', () => ({
  uploadFile: jest.fn()
}));

jest.mock('../../src/models', () => ({
  Invoice: {
    findByPk: jest.fn(),
    create: jest.fn(), 
    update: jest.fn()
  }
}));

describe('uploadInvoice', () => {
  const TEST_FILE_PATH = path.join(__dirname, '..', 'controllers', 'test-files', 'test-invoice.pdf');
  const TEST_FILE = { buffer: fs.readFileSync(TEST_FILE_PATH) };
  const TEST_S3_URL = 'https://s3.amazonaws.com/test-bucket/test-file.pdf';

  let mockParams, mockPartnerId, mockClient; 

  beforeEach(() => {
    mockPartnerId = '123'
    mockParams = { buffer:TEST_FILE.buffer, partnerId:mockPartnerId }
    jest.clearAllMocks();

    mockClient = {
      beginAnalyzeDocument: jest.fn().mockResolvedValue({
        pollUntilDone: jest.fn().mockResolvedValue(null),
      }),
    };

    DocumentAnalysisClient.mockImplementation(() => mockClient);
  })

  test('should return invoice object when upload is successful', async () => {
    s3Service.uploadFile.mockResolvedValue(TEST_S3_URL);
    const mockInvoiceData = {
      partner_id: mockPartnerId,
      file_url: TEST_S3_URL,
      status: "Processing",
    };

    Invoice.create.mockResolvedValue(mockInvoiceData);
    Invoice.update.mockResolvedValue(mockInvoiceData);

    const result = await invoiceService.uploadInvoice(mockParams);
    expect(s3Service.uploadFile).toHaveBeenCalledWith(TEST_FILE.buffer);
    expect(Invoice.create).toHaveBeenCalledWith({ ...mockInvoiceData });
    expect(result).toHaveProperty('details');
  });

  test('should raise error when S3 upload fails', async () => {
    s3Service.uploadFile.mockRejectedValue(new Error('Failed to upload file to S3'));

    await expect(invoiceService.uploadInvoice(mockParams)).rejects.toThrow('Failed to upload file to S3');
  });

  test('should raise error when saving to database fails', async () => {
    s3Service.uploadFile.mockResolvedValue(TEST_S3_URL);
    Invoice.create.mockRejectedValue(new Error('Failed to save invoice to database'));

    await expect(invoiceService.uploadInvoice(mockParams)).rejects.toThrow('Failed to save invoice to database');
  });
});

describe("getInvoiceById", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Should return an invoice when given a valid ID", async () => {
    const mockInvoice = {
      id: 1,
      invoice_date: "2025-02-01",
      due_date: "2025-03-01",
      purchase_order_id: 1,
      total_amount: 500.00,
      subtotal_amount: 450.00,
      discount_amount: 50.00,
      payment_terms: "Net 30",
      file_url: 'https://example.com/invoice.pdf',
      status: "Analyzed",
    };

    Invoice.findByPk.mockResolvedValue(mockInvoice);

    const invoice = await invoiceService.getInvoiceById(1);

    expect(invoice).toEqual(mockInvoice);
  });

  test("Should throw an error when invoice is not found", async () => {
    Invoice.findByPk.mockResolvedValue(null);

    await expect(invoiceService.getInvoiceById(99999999)).rejects.toThrow("Invoice not found");
  });

  test("Should throw an error when database fails", async () => {
    Invoice.findByPk.mockRejectedValue(new Error("Database error"));

        await expect(invoiceService.getInvoiceById(1)).rejects.toThrow("Database error");
    });
});

describe("Invoice Analysis Service", () => {
  const documentUrl = "https://slicedinvoices.com/pdf/wordpress-pdf-invoice-plugin-sample.pdf";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Positive Cases", () => {
    test("should successfully process a valid PDF", async () => {
      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockResolvedValue({
          pollUntilDone: jest.fn().mockResolvedValue({ success: true }),
        }),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      const result = await invoiceService.analyzeInvoice(documentUrl);
      expect(result).toEqual({
        message: "PDF processed successfully",
        data: { success: true },
      });
    });
  });

  describe("Negative Cases", () => {
    test("should throw an error if documentUrl is missing", async () => {
      await expect(invoiceService.analyzeInvoice()).rejects.toThrow("documentUrl is required");
    });

    test("should throw 'Service is temporarily unavailable' if API returns 503", async () => {
      const mockError = new Error("Service Unavailable");
      mockError.statusCode = 503;

      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockRejectedValue(mockError),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      await expect(invoiceService.analyzeInvoice(documentUrl)).rejects.toThrow(
        "Service is temporarily unavailable. Please try again later."
      );
    });

    test("should throw 'Conflict error occurred' if API returns 409", async () => {
      const mockError = new Error("Conflict Error");
      mockError.statusCode = 409;

      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockRejectedValue(mockError),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      await expect(invoiceService.analyzeInvoice(documentUrl)).rejects.toThrow(
        "Conflict error occurred. Please check the document and try again."
      );
    });

    test("should throw 'Failed to process the document' for any other API error", async () => {
      const mockError = new Error("Unknown Error");
      mockError.statusCode = 500;

      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockRejectedValue(mockError),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      await expect(invoiceService.analyzeInvoice(documentUrl)).rejects.toThrow(
        "Failed to process the document"
      );
    });
  });

  describe("Corner Cases", () => {
    test("should handle empty response from API gracefully", async () => {
      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockResolvedValue({
          pollUntilDone: jest.fn().mockResolvedValue(null),
        }),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      const result = await invoiceService.analyzeInvoice(documentUrl);
      expect(result).toEqual({
        message: "PDF processed successfully",
        data: null,
      });
    });

    test("should handle API response with missing fields", async () => {
      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockResolvedValue({
          pollUntilDone: jest.fn().mockResolvedValue({}),
        }),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      const result = await invoiceService.analyzeInvoice(documentUrl);
      expect(result).toEqual({
        message: "PDF processed successfully",
        data: {},
      });
    });
  });
});
