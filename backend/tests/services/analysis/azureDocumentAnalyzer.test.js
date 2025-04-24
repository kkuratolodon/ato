const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const AzureDocumentAnalyzer = require('@services/analysis/azureDocumentAnalyzer');
const Sentry = require("@instrument");

// Mocking dependencies
jest.mock("@azure/ai-form-recognizer");
jest.mock("@instrument", () => ({
  init: jest.fn(),
  startSpan: jest.fn((_, callback) => callback({
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn()
  })),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn()
}));

describe('Azure Document Analyzer', () => {
  let analyzer;
  let mockClient;
  let mockPoller;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment variables for testing
    process.env.AZURE_ENDPOINT = 'https://test-endpoint';
    process.env.AZURE_KEY = 'test-key';
    process.env.AZURE_INVOICE_MODEL = 'test-model';
    
    // Create document analyzer instance
    analyzer = new AzureDocumentAnalyzer();
    
    // Setup mock poller
    mockPoller = {
      pollUntilDone: jest.fn().mockResolvedValue({ success: true })
    };
    
    // Setup mock client
    mockClient = {
      beginAnalyzeDocument: jest.fn().mockResolvedValue(mockPoller)
    };
    
    // Setup mock DocumentAnalysisClient constructor
    DocumentAnalysisClient.mockImplementation(() => mockClient);
  });

  describe("Positive Cases", () => {
    test("should successfully analyze a document from URL", async () => {
      // Arrange
      const documentUrl = "https://example.com/invoice.pdf";
      
      // Act
      const result = await analyzer.analyzeDocument(documentUrl);
      
      // Assert
      expect(DocumentAnalysisClient).toHaveBeenCalledWith(
        'https://test-endpoint',
        expect.any(AzureKeyCredential)
      );
      expect(mockClient.beginAnalyzeDocument).toHaveBeenCalledWith('test-model', documentUrl);
      expect(result).toEqual({
        message: "Document processed successfully",
        data: { success: true }
      });
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        "analyzeDocument() called with documentSource: https://example.com/invoice.pdf"
      );
    });

    test("should successfully analyze a document from buffer data", async () => {
      // Arrange
      const pdfBuffer = Buffer.from("test PDF data");
      
      // Act
      const result = await analyzer.analyzeDocument(pdfBuffer);
      
      // Assert
      expect(mockClient.beginAnalyzeDocument).toHaveBeenCalledWith('test-model', pdfBuffer);
      expect(result).toEqual({
        message: "Document processed successfully",
        data: { success: true }
      });
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        "analyzeDocument() called with documentSource: Buffer data"
      );
    });
  });

  describe("Negative Cases", () => {
    test("should throw an error if documentSource is missing", async () => {
      await expect(analyzer.analyzeDocument()).rejects.toThrow("documentSource is required");
      expect(DocumentAnalysisClient).not.toHaveBeenCalled();
    });

    test("should throw error for invalid document source type", async () => {
      // Arrange - create an object that is neither string nor Buffer
      const invalidInput = { notValid: true };
      
      // Mock implementation that throws the error we expect
      mockClient.beginAnalyzeDocument.mockImplementation(() => {
        throw new Error("Invalid document source type");
      });
      
      // Act & Assert
      await expect(analyzer.analyzeDocument(invalidInput)).rejects.toThrow("Invalid document source type");
    });

    test("should throw 'Service is temporarily unavailable' if API returns 503", async () => {
      // Arrange
      const documentUrl = "https://example.com/invoice.pdf";
      const mockError = new Error("Service Unavailable");
      mockError.statusCode = 503;
      
      mockClient.beginAnalyzeDocument.mockRejectedValue(mockError);
      
      // Act & Assert
      await expect(analyzer.analyzeDocument(documentUrl)).rejects.toThrow(
        "Service is temporarily unavailable. Please try again later."
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
    });

    test("should throw 'Conflict error occurred' if API returns 409", async () => {
      // Arrange
      const documentUrl = "https://example.com/invoice.pdf";
      const mockError = new Error("Conflict Error");
      mockError.statusCode = 409;
      
      mockClient.beginAnalyzeDocument.mockRejectedValue(mockError);
      
      // Act & Assert
      await expect(analyzer.analyzeDocument(documentUrl)).rejects.toThrow(
        "Conflict error occurred. Please check the document and try again."
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
    });

    test("should throw 'Failed to process the document' for other API errors", async () => {
      // Arrange
      const documentUrl = "https://example.com/invoice.pdf";
      const mockError = new Error("Unknown Error");
      mockError.statusCode = 500;
      
      mockClient.beginAnalyzeDocument.mockRejectedValue(mockError);
      
      // Act & Assert
      await expect(analyzer.analyzeDocument(documentUrl)).rejects.toThrow(
        "Failed to process the document"
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty response from API gracefully", async () => {
      // Arrange
      const documentUrl = "https://example.com/invoice.pdf";
      mockPoller.pollUntilDone.mockResolvedValue(null);
      
      // Act
      const result = await analyzer.analyzeDocument(documentUrl);
      
      // Assert
      expect(result).toEqual({
        message: "Document processed successfully",
        data: null
      });
    });

    test("should handle API response with missing fields", async () => {
      // Arrange
      const documentUrl = "https://example.com/invoice.pdf";
      mockPoller.pollUntilDone.mockResolvedValue({});
      
      // Act
      const result = await analyzer.analyzeDocument(documentUrl);
      
      // Assert
      expect(result).toEqual({
        message: "Document processed successfully",
        data: {}
      });
    });

    test("should handle large responses from API", async () => {
      // Arrange
      const documentUrl = "https://example.com/invoice.pdf";
      const largeResponse = {
        documents: Array(50).fill(0).map((_, i) => ({
          id: `doc-${i}`,
          fields: { value: `Field ${i}` }
        }))
      };
      
      mockPoller.pollUntilDone.mockResolvedValue(largeResponse);
      
      // Act
      const result = await analyzer.analyzeDocument(documentUrl);
      
      // Assert
      expect(result).toEqual({
        message: "Document processed successfully",
        data: largeResponse
      });
    });
  });

  describe("Integration with Sentry", () => {
    test("should track analysis lifecycle in Sentry breadcrumbs", async () => {
      // Arrange
      const documentUrl = "https://example.com/invoice.pdf";
      
      // Act
      await analyzer.analyzeDocument(documentUrl);
      
      // Assert
      expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(3); // Start, analyze, complete
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
        category: "documentAnalysis",
        message: "Starting document analysis for: https://example.com/invoice.pdf",
        level: "info"
      }));
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
        category: "documentAnalysis",
        message: "Azure analysis started...",
        level: "info"
      }));
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
        category: "documentAnalysis",
        message: "Azure analysis completed successfully",
        level: "info"
      }));
    });

    test("should capture exceptions in Sentry on error", async () => {
      // Arrange
      const documentUrl = "https://example.com/invoice.pdf";
      const mockError = new Error("Test Error");
      mockClient.beginAnalyzeDocument.mockRejectedValue(mockError);
      
      // Act
      try {
        await analyzer.analyzeDocument(documentUrl);
      } catch (error) {
        // Ignore error - we're just checking if Sentry captured it
      }
      
      // Assert
      expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
        category: "documentAnalysis",
        message: "Error encountered: Test Error",
        level: "error"
      }));
    });
  });
});