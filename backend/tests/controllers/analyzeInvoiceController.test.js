const request = require('supertest');
const app = require('../../src/app');
const InvoiceAnalyzer = require("../../src/services/analyzeInvoiceService");

jest.mock("../../src/services/analyzeInvoiceService");

describe("Invoice Controller - Analysis", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const documentUrl =
    "https://slicedinvoices.com/pdf/wordpress-pdf-invoice-plugin-sample.pdf";

  describe("Negative Cases", () => {
    test("should return 400 for missing documentUrl", async () => {
      const response = await request(app).post("/api/invoices/analyze").send({});
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("documentUrl is required");
    });

    test("should return 400 for invalid PDF URL", async () => {
      InvoiceAnalyzer.analyzeInvoice.mockImplementation(() => {
        throw new Error("Invalid PDF URL");
      });

      const response = await request(app)
        .post("/api/invoices/analyze")
        .send({ documentUrl: "invalid-url" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid PDF URL");
    });

    test("should return 500 for internal server error", async () => {
      InvoiceAnalyzer.analyzeInvoice.mockImplementation(() => {
        throw new Error("Unexpected error occurred");
      });

      const response = await request(app)
        .post("/api/invoices/analyze")
        .send({ documentUrl: documentUrl });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Internal Server Error");
    });
  });

  describe("Positive Case", () => {
    test("should return 200 and analysis result for valid documentUrl", async () => {
      InvoiceAnalyzer.analyzeInvoice.mockResolvedValue({
        message: "PDF processed successfully",
        data: { text: "Sample analysis result" },
      });

      const response = await request(app)
        .post("/api/invoices/analyze")
        .send({ documentUrl: documentUrl });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("PDF processed successfully");
      expect(response.body.data).toHaveProperty("text", "Sample analysis result");
    });
  });

  describe("Corner Cases", () => {
    test("should return 400 if documentUrl is an empty string", async () => {
      const response = await request(app)
        .post("/api/invoices/analyze")
        .send({ documentUrl: "" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("documentUrl is required");
    });

    test("should handle unexpected response format from the service", async () => {
      InvoiceAnalyzer.analyzeInvoice.mockImplementation(() => {
        throw new Error("Invalid response format");
      });

      const response = await request(app)
        .post("/api/invoices/analyze")
        .send({ documentUrl: documentUrl });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Internal Server Error");
    });
  });
});
