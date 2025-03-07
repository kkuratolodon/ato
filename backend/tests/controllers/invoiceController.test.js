const request = require("supertest");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const app = require('../../src/app');

// Controller & Services
const invoiceController = require("../../src/controllers/invoiceController");
const { uploadInvoice } = require("../../src/controllers/invoiceController");
const invoiceService = require("../../src/services/invoiceServices");
const authService = require("../../src/services/authService");

// Jest-mock-req-res untuk unit test
const { mockRequest, mockResponse } = require("jest-mock-req-res");

// Mock services
jest.mock("../../src/services/invoiceServices");
jest.mock("../../src/services/authService");

/* ------------------------------------------------------------------
   1) INVOICE CONTROLLER - uploadInvoice (UNIT TEST)
   ------------------------------------------------------------------ */
describe("Invoice Controller - uploadInvoice (Unit Test)", () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();

    // Default: authService.authenticate -> true
    authService.authenticate.mockResolvedValue(true);
  });

  test("should return status 401 if req.user is not defined", async () => {
    // Simulasikan tidak ada req.user (belum di-auth)
    req.user = undefined;
    req.file = { originalname: "test.pdf" };

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  test("should return status 400 if no file is uploaded", async () => {
    // req.user ada, tapi file tidak ada
    req.user = { uuid: "dummy-uuid" };
    req.file = undefined;

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No file uploaded" });
  });

  test("should return status 504 if simulateTimeout === 'true'", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = { originalname: "test.pdf" };
    req.query = { simulateTimeout: "true" };

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({ message: "Server timeout during upload" });
  });

  test("should return status 415 if validatePDF fails", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("test"),
      mimetype: "application/pdf",
    };

    invoiceService.validatePDF.mockRejectedValue(new Error("Not PDF"));

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({ message: "File format is not PDF" });
  });

  test("should return status 400 if PDF is encrypted", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    invoiceService.validatePDF.mockResolvedValue(true);
    invoiceService.isPdfEncrypted.mockResolvedValue(true);

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "pdf is encrypted" });
  });

  test("should return status 400 if PDF file is invalid", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    invoiceService.validatePDF.mockResolvedValue(true);
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(false);

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "PDF file is invalid" });
  });

  test("should return status 413 if file size is too large", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    invoiceService.validatePDF.mockResolvedValue(true);
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(true);
    invoiceService.validateSizeFile.mockRejectedValue(new Error("File too big"));

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ message: "File size exceeds maximum limit" });
  });

  test("should return status 200 if all validations pass", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    invoiceService.validatePDF.mockResolvedValue(true);
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(true);
    invoiceService.validateSizeFile.mockResolvedValue(true);
    invoiceService.uploadInvoice.mockResolvedValue({
      message: "Invoice upload service called",
      filename: "test.pdf",
    });

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invoice upload service called",
      filename: "test.pdf",
    });
  });

  test("should return status 500 if unexpected error occurs", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    // Pastikan validatePDF tidak error, agar tidak berakhir di validasi lain
    invoiceService.validatePDF.mockResolvedValue(true);
    invoiceService.isPdfEncrypted.mockImplementation(() => {
      throw new Error("Some unexpected error");
    });

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

/* ------------------------------------------------------------------
   2) INVOICE CONTROLLER (Integration) with FakeAuthMiddleware
   ------------------------------------------------------------------ */
async function fakeAuthMiddleware(req, res, next) {
  try {
    const { client_id, client_secret } = req.body;
    const partner = await authService.authenticate(client_id, client_secret);
    if (!partner) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = partner;
    next();
  } catch (err) {
    console.error("fakeAuthMiddleware error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

describe("Invoice Controller (Integration) with Supertest", () => {
  let localApp;

  beforeAll(() => {
    localApp = express();
    localApp.use(bodyParser.json());
    localApp.use(bodyParser.urlencoded({ extended: true }));

    // Route: uploadMiddleware -> fakeAuthMiddleware -> uploadInvoice
    localApp.post(
      "/api/upload",
      invoiceController.uploadMiddleware, // parse file
      fakeAuthMiddleware,                   // cek auth
      invoiceController.uploadInvoice
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("harus mengembalikan status 401 jika user belum terautentikasi (auth gagal)", async () => {
    // authService kembalikan null => 401
    authService.authenticate.mockResolvedValue(null);

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "invalid_id")
      .field("client_secret", "invalid_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(authService.authenticate).toHaveBeenCalledWith("invalid_id", "invalid_secret");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  test("harus mengembalikan status 400 jika tidak ada file di-upload", async () => {
    // user valid
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "some_id")
      .field("client_secret", "some_secret");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "No file uploaded" });
  });

  test("harus mengembalikan status 504 jika simulateTimeout === 'true'", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });

    const res = await request(localApp)
      .post("/api/upload?simulateTimeout=true")
      .field("client_id", "any_id")
      .field("client_secret", "any_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(res.status).toBe(504);
    expect(res.body).toEqual({ message: "Server timeout during upload" });
  });

  test("harus mengembalikan status 415 jika validatePDF gagal", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    invoiceService.validatePDF.mockRejectedValue(new Error("Invalid PDF"));

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "valid_id")
      .field("client_secret", "valid_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(res.status).toBe(415);
    expect(res.body).toEqual({ message: "File format is not PDF" });
  });

  test("harus mengembalikan status 400 jika PDF terenkripsi", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    invoiceService.validatePDF.mockResolvedValue();
    invoiceService.isPdfEncrypted.mockResolvedValue(true);

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "valid_id")
      .field("client_secret", "valid_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "pdf is encrypted" });
  });

  test("harus mengembalikan status 400 jika PDF rusak", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    invoiceService.validatePDF.mockResolvedValue();
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(false);

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "valid_id")
      .field("client_secret", "valid_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "PDF file is invalid" });
  });

  test("harus mengembalikan status 413 jika ukuran file melebihi limit", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    invoiceService.validatePDF.mockResolvedValue();
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(true);
    invoiceService.validateSizeFile.mockRejectedValue(new Error("File too big"));

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "valid_id")
      .field("client_secret", "valid_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "File size exceeds maximum limit" });
  });

  test("harus mengembalikan status 200 jika semua valid", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    invoiceService.validatePDF.mockResolvedValue();
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(true);
    invoiceService.validateSizeFile.mockResolvedValue();
    invoiceService.uploadInvoice.mockResolvedValue({
      message: "Invoice upload service called",
      filename: "test-invoice.pdf",
    });

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "valid_id")
      .field("client_secret", "valid_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: "Invoice upload service called",
      filename: "test-invoice.pdf",
    });
  });

  test("harus mengembalikan status 500 jika terjadi error tak terduga", async () => {
    authService.authenticate.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "any_id")
      .field("client_secret", "any_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Internal server error" });
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
      total_amount: 500.0,
      subtotal_amount: 450.0,
      discount_amount: 50.0,
      payment_terms: "Net 30",
      file_url: "https://example.com/invoice.pdf",
      status: "Paid",
    };

    invoiceService.getInvoiceById.mockResolvedValue(mockInvoice);

    const response = await request(app).get(`/api/invoices/${mockInvoice.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockInvoice);
  });

  test("Should return 404 when invoice is not found", async () => {
    invoiceService.getInvoiceById.mockRejectedValue(new Error("Invoice not found"));

    const response = await request(app).get(`/api/invoices/99999999`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Invoice not found");
  });

  test("Should return 500 when internal server error occurs", async () => {
    invoiceService.getInvoiceById.mockRejectedValue(new Error("Internal server error"));

    const response = await request(app).get(`/api/invoices/1`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error");
  });
});

  /* ------------------------------------------------------------------
     3) INVOICE CONTROLLER - analyzeInvoice (UNIT TEST)
     ------------------------------------------------------------------ */
  describe("Invoice Controller - analyzeInvoice (Unit Test)", () => {
    let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    req.user = { uuid: "dummy-uuid" }; // Pastikan user tersedia agar tidak kembali 401
    jest.clearAllMocks();
  });

  test("should return 400 for missing documentUrl", async () => {
    req.body = {};
    await invoiceController.analyzeInvoice(req, res);
    expect(res.status).toBeCalledWith(400);
    expect(res.json).toBeCalledWith({ message: "documentUrl is required" });
  });

  test("should return 500 for internal server error", async () => {
    invoiceService.analyzeInvoice.mockImplementation(() => {
      throw new Error("Unexpected error occurred");
    });

    req.body = { documentUrl: "https://example.com/invoice.pdf" };
    await invoiceController.analyzeInvoice(req, res);

    expect(res.status).toBeCalledWith(500);
    expect(res.json).toBeCalledWith({ message: "Internal Server Error" });
  });

});
