const request = require('supertest');
const app = require('../src/app');
const InvoiceAnalyzer = require("../src/services/analyzeInvoiceService");

jest.mock("../src/services/analyzeInvoiceService");

describe("Invoice Analysis API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validDocumentUrl =
    "https://slicedinvoices.com/pdf/wordpress-pdf-invoice-plugin-sample.pdf";
  const invalidDocumentUrl = "https://slicedinvoices.com/pdf/wordpress-pdf.pdf";

  describe("Invalid Requests", () => {
    test.each([
      ["put", "/api/invoices/analyze", 405, "Method not allowed"],
      ["post", "/api/invoices/invalid-endpoint", 404, "Endpoint not found"],
    ])("should return %d for %s %s", async (method, url, status, message) => {
      const response = await request(app)[method.toLowerCase()](url).send({
        documentUrl: validDocumentUrl,
      });
      expect(response.status).toBe(status);
      expect(response.body.message).toBe(message);
    });

    test("should return 400 for missing documentUrl", async () => {
      const response = await request(app).post("/api/invoices/analyze").send({});
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("documentUrl is required");
    });

    test("should return 400 for invalid documentUrl", async () => {
      InvoiceAnalyzer.analyzeInvoice.mockRejectedValue({
        message: "Invalid PDF URL",
      });

      const response = await request(app)
        .post("/api/invoices/analyze")
        .send({ documentUrl: invalidDocumentUrl });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid PDF URL");
    });
  });

  describe("Successful Analysis", () => {
    test("should return 200 and analysis result for valid documentUrl", async () => {
      InvoiceAnalyzer.analyzeInvoice.mockResolvedValue({
        message: "PDF processed successfully",
        data: { text: "Sample analysis result" },
      });

      const response = await request(app)
        .post("/api/invoices/analyze")
        .send({ documentUrl: validDocumentUrl });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("PDF processed successfully");
      expect(response.body.data).toHaveProperty("text", "Sample analysis result");
    });
  });

  describe("Server Errors", () => {
    test("should return 500 for internal server error", async () => {
      InvoiceAnalyzer.analyzeInvoice.mockImplementation(() => {
        throw new Error("Simulated server crash");
      });

      const response = await request(app)
        .post("/api/invoices/analyze")
        .send({ documentUrl: validDocumentUrl });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Internal Server Error");
    });
  });
});
