const { analyzeInvoice } = require("../src/services/analyzeInvoiceService");
const { DocumentAnalysisClient } = require("@azure/ai-form-recognizer");

jest.mock("https");
jest.mock("@azure/ai-form-recognizer");

describe("Azure Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const exampleUrl = "https://slicedinvoices.com/pdf/wordpress-pdf-invoice-plugin-sample.pdf";

  describe("analyzeInvoice", () => {
    test("should throw an error if documentUrl is missing", async () => {
      await expect(analyzeInvoice()).rejects.toThrow("documentUrl is required");
    });

    test("should successfully process a valid PDF", async () => {
      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockResolvedValue({
          pollUntilDone: jest.fn().mockResolvedValue({ success: true }),
        }),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      const result = await analyzeInvoice(exampleUrl);
      expect(result).toEqual({
        message: "PDF processed successfully",
        data: { success: true },
      });
    });

    test("should throw 'Service is temporarily unavailable' if API returns 503", async () => {
      const mockError = new Error("Service Unavailable");
      mockError.statusCode = 503;

      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockRejectedValue(mockError),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      await expect(analyzeInvoice(exampleUrl)).rejects.toThrow(
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

      await expect(analyzeInvoice(exampleUrl)).rejects.toThrow(
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

      await expect(analyzeInvoice(exampleUrl)).rejects.toThrow(
        "Failed to process the document"
      );
    });
  });
});
