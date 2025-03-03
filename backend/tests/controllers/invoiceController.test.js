const request = require("supertest");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mockFs = require("mock-fs");

// Controller & Services
const app = require("../../src/app");
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
   1) INVOICE UPLOAD ENDPOINT TEST (Integration using global app)
   ------------------------------------------------------------------ */
describe("Invoice Upload Endpoint", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.authenticate.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockFs.restore();
  });

  test("Invoice upload service called success (real function)", async () => {
    const mockFileName = "test-invoice.pdf";
    const filePath = path.join(__dirname, "test-files", mockFileName);

    const response = await request(app)
      .post("/api/invoices/upload")
      .attach("file", filePath, "test-invoice.pdf")
      .field("client_id", "test-id")
      .field("client_secret", "test-secret");

    expect(response.status).toBe(501);
  });

  test("Invoice upload service called success (mocked)", async () => {
    const mockFileName = "test-invoice.pdf";

    jest.spyOn(invoiceService, "uploadInvoice").mockResolvedValue({
      message: "Invoice upload service called",
      filename: mockFileName,
    });

    const filePath = path.join(__dirname, "test-files", mockFileName);
    const response = await request(app)
      .post("/api/invoices/upload")
      .attach("file", filePath)
      .field("client_id", "test-id")
      .field("client_secret", "test-secret");

    expect(response.status).toBe(501);
    expect(response.body.message).toBe("Invoice upload service called");
    expect(response.body.filename).toBe(mockFileName);
  });

  test("Invoice upload service called error", async () => {
    const mockFileName = "test-invoice.pdf";

    jest.spyOn(invoiceService, "uploadInvoice").mockRejectedValue(
      new Error("Error")
    );

    const filePath = path.join(__dirname, "test-files", mockFileName);
    const response = await request(app)
      .post("/api/invoices/upload")
      .attach("file", filePath)
      .field("client_id", "test-id")
      .field("client_secret", "test-secret");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error");
  });

  test("Returns 415 when file is not a PDF", async () => {
    const mockFileName = "test-invoice.pdf";
    jest
      .spyOn(invoiceService, "validatePDF")
      .mockRejectedValue(new Error("Error"));

    const filePath = path.join(__dirname, "test-files", mockFileName);
    const response = await request(app)
      .post("/api/invoices/upload")
      .attach("file", filePath)
      .field("client_id", "test-id")
      .field("client_secret", "test-secret");

    expect(response.status).toBe(415);
    expect(response.body.message).toBe("File format is not PDF");
  });

  test("Returns 400 when PDF is corrupted", async () => {
    const mockFileName = "corrupted.pdf";
    const filePath = path.join(__dirname, "test-files", mockFileName);

    jest.spyOn(invoiceService, "isPdfEncrypted").mockResolvedValue(true);

    const response = await request(app)
      .post("/api/invoices/upload")
      .attach("file", filePath)
      .field("client_id", "test-id")
      .field("client_secret", "test-secret");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("pdf is encrypted");
    expect(invoiceService.isPdfEncrypted).toHaveBeenCalled();
  });

  test("Returns 504 when upload times out", async () => {
    const mockFileName = "test-invoice.pdf";
    const filePath = path.join(__dirname, "test-files", mockFileName);

    const response = await request(app)
      .post("/api/invoices/upload")
      .query({ simulateTimeout: "true" })
      .attach("file", filePath)
      .field("client_id", "test-id")
      .field("client_secret", "test-secret");

    expect(response.status).toBe(504);
    expect(response.body.message).toBe("Server timeout during upload");
  });

  test("Returns 400 when PDF file is invalid", async () => {
    const mockFileName = "test-invoice.pdf";
    const filePath = path.join(__dirname, "test-files", mockFileName);

    jest.spyOn(invoiceService, "checkPdfIntegrity").mockResolvedValue(false);

    const response = await request(app)
      .post("/api/invoices/upload")
      .attach("file", filePath)
      .field("client_id", "test-id")
      .field("client_secret", "test-secret");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("PDF file is invalid");
    expect(invoiceService.checkPdfIntegrity).toHaveBeenCalled();
  });

  test("Returns 413 when file is too large", async () => {
    const mockFileName = "test-invoice.pdf";
    const filePath = path.join(__dirname, "test-files", mockFileName);

    jest
      .spyOn(invoiceService, "validateSizeFile")
      .mockRejectedValue(new Error("File size exceeds maximum limit"));

    const response = await request(app)
      .post("/api/invoices/upload")
      .attach("file", filePath)
      .field("client_id", "test-id")
      .field("client_secret", "test-secret");

    expect(response.status).toBe(413);
    expect(response.body.message).toBe("File size exceeds maximum limit");
    expect(invoiceService.validateSizeFile).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------
   2) INVOICE CONTROLLER - uploadInvoice (Unit Test)
   ------------------------------------------------------------------ */
describe("Invoice Controller - uploadInvoice", () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();

    // Default: authService.authenticate -> true
    authService.authenticate.mockResolvedValue(true);
  });

  test("should return status 400 if no file is uploaded", async () => {
    req.file = undefined;
    req.body = { client_id: "some_id", client_secret: "some_secret" };

    await uploadInvoice(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "No file uploaded" });
  });

  test("should return status 401 if authentication fails", async () => {
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("test"),
      mimetype: "application/pdf",
    };
    req.body = { client_id: "invalid_id", client_secret: "invalid_secret" };

    authService.authenticate.mockResolvedValue(false);

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  test("should return status 501 and call invoiceService if authentication succeeds", async () => {
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };
    req.body = { client_id: "valid_id", client_secret: "valid_secret" };
    req.query = {};

    authService.authenticate.mockResolvedValue(true);

    invoiceService.validatePDF.mockResolvedValue(true);
    invoiceService.isPdfEncrypted.mockResolvedValue(false);
    invoiceService.checkPdfIntegrity.mockResolvedValue(true);
    invoiceService.validateSizeFile.mockResolvedValue(true);
    invoiceService.uploadInvoice.mockResolvedValue({
      message: "Invoice upload service called",
      filename: "test.pdf",
    });

    await uploadInvoice(req, res);

    expect(authService.authenticate).toHaveBeenCalledWith("valid_id", "valid_secret");
    expect(invoiceService.uploadInvoice).toHaveBeenCalledWith(req.file);
    expect(res.status).toHaveBeenCalledWith(501);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invoice upload service called",
      filename: "test.pdf",
    });
  });

  test("should return status 500 if an error occurs during authentication", async () => {
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("test"),
      mimetype: "application/pdf",
    };
    req.body = { client_id: "any_id", client_secret: "any_secret" };

    authService.authenticate.mockRejectedValue(new Error("Test error"));

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

/* ------------------------------------------------------------------
   3) INVOICE CONTROLLER (Integration) with FakeAuthMiddleware
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
      fakeAuthMiddleware,                // cek auth
      invoiceController.uploadInvoice
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("harus mengembalikan status 400 jika tidak ada file di-upload", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "some_id")
      .field("client_secret", "some_secret");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "No file uploaded" });
  });

  test("harus melewati middleware dan lanjut ke controller jika file ada", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "some_id")
      .field("client_secret", "some_secret")
      .attach("file", path.join(__dirname, "../test-files/test-invoice.pdf"));

    // Hasil status bergantung validasi PDF dsb.
    // Yang jelas, "bukan 401" karena user valid
    expect([400, 415, 501, 200, 413, 500, 504]).toContain(res.status);
    expect(authService.authenticate).toHaveBeenCalledWith("some_id", "some_secret");
  });

  test("harus mengembalikan status 401 jika autentikasi gagal", async () => {
    authService.authenticate.mockResolvedValue(null);

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "invalid_id")
      .field("client_secret", "invalid_secret")
      .attach("file", path.join(__dirname, "../test-files/test-invoice.pdf"));

    expect(authService.authenticate).toHaveBeenCalledWith("invalid_id", "invalid_secret");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  test("harus mengembalikan status 504 jika simulateTimeout === 'true'", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });

    const res = await request(localApp)
      .post("/api/upload?simulateTimeout=true")
      .field("client_id", "any_id")
      .field("client_secret", "any_secret")
      .attach("file", path.join(__dirname, "../test-files/test-invoice.pdf"));

    expect(res.status).toBe(504);
    expect(res.body).toEqual({ message: "Server timeout during upload" });
  });

  test("harus mengembalikan status 415 jika validatePDF melempar error (bukan PDF)", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    invoiceService.validatePDF.mockRejectedValue(new Error("Invalid PDF"));

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "valid_id")
      .field("client_secret", "valid_secret")
      .attach("file", path.join(__dirname, "../test-files/test-invoice.pdf"));

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
      .attach("file", path.join(__dirname, "../test-files/test-invoice.pdf"));

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
      .attach("file", path.join(__dirname, "../test-files/test-invoice.pdf"));

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
      .attach("file", path.join(__dirname, "../test-files/test-invoice.pdf"));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "File size exceeds maximum limit" });
  });

  test("harus mengembalikan status 501 jika semua valid", async () => {
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
      .attach("file", path.join(__dirname, "../test-files/test-invoice.pdf"));

    expect(res.status).toBe(501);
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
      .attach("file", path.join(__dirname, "../test-files/test-invoice.pdf"));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Internal server error" });
  });
});
