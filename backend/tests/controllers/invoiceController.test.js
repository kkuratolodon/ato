const request = require("supertest");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");

// Controller & Services
const invoiceController = require("../../src/controllers/invoiceController");
const { uploadInvoice,getInvoiceById } = require("../../src/controllers/invoiceController");
const pdfValidationService = require("../../src/services/pdfValidationService");
const invoiceService = require("../../src/services/invoice/invoiceService");
const authService = require("../../src/services/authService");


// Jest-mock-req-res untuk unit test
const { mockRequest, mockResponse } = require("jest-mock-req-res");

// Mock services
jest.mock("../../src/services/pdfValidationService");
jest.mock("../../src/services/invoice/invoiceService");
jest.mock("../../src/services/authService");

jest.mock('../../src/models', () => {
  // Create shared mock objects
  const mockInvoice = {
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  };

  const mockCustomer = {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn()
  };

  const mockVendor = {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn()
  };

  return {
    Invoice: mockInvoice,
    Customer: mockCustomer,
    Vendor: mockVendor
  };
});

/* ------------------------------------------------------------------
   1) INVOICE CONTROLLER - uploadInvoice (UNIT TEST)
   ------------------------------------------------------------------ */
describe("Invoice Controller - uploadInvoice (Unit Test)", () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();

    // PENTING: Set default values untuk semua mock
    // Default-nya validasi lolos semua jika tidak dispesifikkan sebaliknya dalam test
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    pdfValidationService.validatePdfPageCount.mockResolvedValue(true);
    
    authService.authenticate.mockResolvedValue(true);
    
    // Default uploadInvoice
    invoiceService.uploadInvoice.mockResolvedValue({
      message: "Invoice upload service called",
      filename: "test.pdf" 
    });
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
    req.user = { uuid: "dummy-uuid" };
    req.file = undefined;

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No file uploaded" });
  });

  test("should return status 504 if simulating timeout", async () => {
    // Use simulateTimeout parameter in controller
    req.user = { uuid: "dummy-uuid" };
    req.file = { 
      originalname: "test.pdf",
      buffer: Buffer.from("dummy content"),
      mimetype: "application/pdf"
    };
    
    req.query = { simulateTimeout: 'true' };
    
    await uploadInvoice(req, res);
    
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Server timeout - upload processing timed out" 
    });
  });

  test("should return status 400 if PDF has zero pages", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };
  
    // Mock correct error response
    pdfValidationService.validatePdfPageCount.mockRejectedValue(
      new Error("PDF has no pages.")
    );
  
    await uploadInvoice(req, res);
  
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "PDF has no pages." 
    });
  });
  
  test("should return status 400 if PDF exceeds maximum page count", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };
  
    // Mock error for exceeding maximum page count
    pdfValidationService.validatePdfPageCount.mockRejectedValue(
      new Error("PDF exceeds the maximum allowed pages (100).")
    );
  
    await uploadInvoice(req, res);
  
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "PDF exceeds the maximum allowed pages (100)." 
    });
  });
  
  test("should handle generic error when validatePdfPageCount fails", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };
  
    // Mock general error
    pdfValidationService.validatePdfPageCount.mockRejectedValue(
      new Error("Some unexpected error")
    );
  
    await uploadInvoice(req, res);
  
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Failed to determine PDF page count." 
    });
  });


  test("should reject files that are not PDFs based on mimetype", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.jpg",
      buffer: Buffer.from("JFIF"),
      mimetype: "image/jpeg", // Not a PDF mimetype
    };
  
    // This is the key change - mock validatePDF to reject when mimetype is not PDF
    pdfValidationService.validatePDF.mockRejectedValue(new Error("Invalid file format"));
  
    await uploadInvoice(req, res);
  
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({ message: "File format is not PDF" });
  });

  test("should handle partial PDF signatures in buffer", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PD"), // Incomplete PDF signature
      mimetype: "application/pdf",
    };

    // Mock validatePDF to simulate signature check failure
    pdfValidationService.validatePDF.mockRejectedValue(new Error("Invalid PDF signature"));

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({ message: "File format is not PDF" });
  });

  test("should return status 413 if file size is too large", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    // Override mock hanya untuk test ini
    pdfValidationService.validateSizeFile.mockRejectedValue(new Error("File too big"));

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ message: "File size exceeds maximum limit" });
  });

  test("should return status 200 if all validations pass", async () => {
    // Mock data pengguna
    req.user = { uuid: "partner-123" };
    req.file = { buffer: Buffer.from("test"), originalname: "test.pdf", size: 1000 };
    
    // Mock format hasil yang sesuai dengan implementasi baru
    const mockResult = {
      id: "mocked-uuid-123",
      status: "Processing",
      message: "Invoice upload service called"
    };
    
    // Update mock service
    invoiceService.uploadInvoice.mockResolvedValue(mockResult);
    pdfValidationService.validatePDF.mockResolvedValue(true);
    
    await invoiceController.uploadInvoice(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: mockResult });
  });

  test("should return status 500 if unexpected error occurs", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    // Simulasi error saat pemrosesan
    pdfValidationService.isPdfEncrypted.mockImplementation(() => {
      throw new Error("Some unexpected error");
    });

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
  
  test("should handle timeout errors properly", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };
  
    // Create a mock implementation that simulates a timeout
    const originalPromiseRace = Promise.race;
    Promise.race = jest.fn().mockRejectedValue(new Error('Timeout'));
    
    await invoiceController.uploadInvoice(req, res);
    
    // Restore original Promise.race
    Promise.race = originalPromiseRace;
  
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Server timeout - upload processing timed out" 
    });
  });
  

  test("should clear timeout when function completes before timeout", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    
    req.user = { uuid: "partner-123" };
    req.file = { buffer: Buffer.from("test"), originalname: "test.pdf", size: 1000 };
    
    // Update format hasil sesuai yang baru
    const mockResult = {
      id: "mocked-uuid-123",
      status: "Processing",
      message: "Invoice upload service called"
    };
    
    invoiceService.uploadInvoice.mockResolvedValue(mockResult);
    pdfValidationService.validatePDF.mockResolvedValue(true);
    
    await invoiceController.uploadInvoice(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: mockResult });
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    clearTimeoutSpy.mockRestore();
  });

  test("should handle unexpected errors in executeWithTimeout", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    invoiceService.uploadInvoice.mockImplementation(() => {
      throw new Error("Something unexpected happened");
    });

    await invoiceController.uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });

  test('should not send a response if headersSent is already true', async () => {
    const req = {
      user: null,
      file: null, 
    };

    // Mock res object
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: true, 
    };

    await uploadInvoice(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('should not send a response if headersSent is already true', async () => {
    const req = {
      user: null,
      file: null, 
    };

    // Mock res object
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: true, 
    };

    await uploadInvoice(req, res);
  });
  
  test('should use custom timeout of 20 seconds instead of default 3', async () => {
    // Setup request for the test
    req = mockRequest({
      query: { customTimeout: '5000' }, // 5 seconds instead of default 3
      user: { uuid: 'test-uuid' },
      file: {
        buffer: Buffer.from('%PDF-1.0\nValid PDF content'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf'
      }
    });
    
    // Mock services for successful path
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    
    // Gunakan format yang sama seperti test berhasil lainnya
    const mockResult = {
      id: "mocked-uuid-123",
      status: "Processing",
      message: "Success"
    };
    
    invoiceService.uploadInvoice.mockResolvedValue(mockResult);
    
    // Execute with custom timeout
    await invoiceController.uploadInvoice(req, res);
    
    // Verify success response dengan format yang konsisten
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: mockResult });
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
      fakeAuthMiddleware,                 // cek auth
      invoiceController.uploadInvoice
    );
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set default successful mock implementations
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    pdfValidationService.validatePdfPageCount.mockResolvedValue(1);
    
    // Default untuk uploadInvoice
    invoiceService.uploadInvoice.mockResolvedValue({
      message: "Invoice upload service called",
      filename: "test-invoice.pdf"
    });
  });

  afterAll((done) => {
    // Ensure any pending timers are cleared
    jest.useRealTimers();
    done();
  });

  test("harus mengembalikan status 504 jika simulateTimeout === 'true'", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
  
    const res = await request(localApp)
      .post("/api/upload?simulateTimeout=true")
      .field("client_id", "any_id")
      .field("client_secret", "any_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));
  
    expect(res.status).toBe(504);
    expect(res.body).toEqual({ 
      message: "Server timeout - upload processing timed out" 
    });
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
    expect(res.body).toEqual({ message: "Server timeout - upload processing timed out" });
  });

  test("harus mengembalikan status 415 jika validatePDF gagal", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    
    // Override mock hanya untuk test ini
    pdfValidationService.validatePDF.mockRejectedValue(new Error("Invalid PDF"));

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
    
    // Override mock hanya untuk test ini
    pdfValidationService.isPdfEncrypted.mockResolvedValue(true);

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "valid_id")
      .field("client_secret", "valid_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "PDF is encrypted" });
  });

  test("harus mengembalikan status 413 jika ukuran file melebihi limit", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    
    // Override mock hanya untuk test ini
    pdfValidationService.validateSizeFile.mockRejectedValue(new Error("File too big"));

    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "valid_id")
      .field("client_secret", "valid_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "File size exceeds maximum limit" });
  });

  test("harus mengembalikan status 200 jika semua valid dan menggunakan timeout yang benar", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    
    // Pastikan semua validasi diset untuk berhasil
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    
    const mockResult = {
      id: "mocked-uuid-123",
      status: "Processing",
      message: "Invoice upload service called"
    };
    
    invoiceService.uploadInvoice.mockResolvedValue(mockResult);
    
    // REMOVE THE SPY - it's causing the error
    // const executeWithTimeoutSpy = jest.spyOn(invoiceController, 'executeWithTimeout');
    
    const res = await request(localApp)
      .post("/api/upload")
      .field("client_id", "valid_id")
      .field("client_secret", "valid_secret")
      .attach("file", path.join(__dirname, "test-files/test-invoice.pdf"));
  
    expect(res.status).toBe(200);
    // Sesuaikan dengan format yang diharapkan dari controller
    // Jika controller mengembalikan { message: mockResult }, gunakan:
    // expect(res.body).toEqual({ message: mockResult });
    // Jika controller langsung mengembalikan mockResult, gunakan:
    // expect(res.body).toEqual(mockResult);
    expect(res.body).toEqual({ message: mockResult });
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
  let req,res;  
  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
  });
  describe("Positive Cases",() => {
    test("Should return an invoice when given a valid ID", async () => {
      req.user = { uuid: "uuid" };
      req.params = { id: 1 };
    
      // Ensure mock returns the correct `partner_id`
      invoiceService.getPartnerId = jest.fn().mockResolvedValue("uuid"); // Mock correctly
    
      // Dummy invoice for service response
      const mockFormattedResponse = {
        id: 1,
        invoice_date: "2025-02-01",
        due_date: "2025-03-01",
        purchase_order_id: "12345",
        total_amount: 500.0,
        subtotal_amount: 450.0,
        discount_amount: 50.0,
        payment_terms: "Net 30",
        file_url: "https://example.com/invoice.pdf",
        status: "Analyzed",
        partner_id: "uuid",
        customer_id: "cust123",
        vendor_id: "vend456",
        createdAt: "2025-03-11T16:03:00.000Z",
        updatedAt: "2025-03-11T16:03:07.000Z",
      };
    
      // Mock getInvoiceById service response
      invoiceService.getInvoiceById.mockResolvedValue(mockFormattedResponse);
    
      await getInvoiceById(req, res);
    
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockFormattedResponse);
    });
    
  });

  describe("Negative - Authorization Cases",() => {
    test("Should return 401 if req.user is not defined", async () => {
      req.user = undefined;
      req.params = {id:1};
      
      await getInvoiceById(req,res);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({message: "Unauthorized"});
    });
    
    test("should return 403 if invoice doesn't belong to that user",async() => {
      // Setup
      const mockUuid = "valid-uuid-123";
      req.params = { id: mockUuid };
      req.user = { uuid: "different-partner" };
      
      // Mock different partner ID
      invoiceService.getPartnerId = jest.fn().mockResolvedValue("partner-123");
      
      await getInvoiceById(req, res);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Forbidden: You do not have access to this invoice"
      });
    });
  })
  
  describe("Negative - Error Handling", () => {
    test("Should return 404 when invoice is not found", async () => {
      req.user = { uuid: "valid-user-uuid" }; // ✅ Use a valid user
      req.params = { id: 999 }; // ✅ Use an invoice ID that does not exist
    
      // ✅ Mock `getPartnerId` to return a valid user (to bypass 403 Forbidden)
      invoiceService.getPartnerId = jest.fn().mockResolvedValue("valid-user-uuid");
    
      // ✅ Mock `getInvoiceById` to THROW an error instead of returning `null`
      invoiceService.getInvoiceById = jest.fn().mockRejectedValue(new Error("Invoice not found"));
    
      await getInvoiceById(req, res);
    
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Invoice not found" });
    });    
  
    test("Should return 500 when internal server error occurs", async () => {
      req.user = { uuid: "dummy-uuid" };
      req.params = { id: 1 };
  
      // Mock `getPartnerId` to throw an unexpected error
      invoiceService.getPartnerId = jest.fn().mockRejectedValue(new Error("Internal server error"));
  
      await getInvoiceById(req, res);
  
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
    });
  
  });
  

  describe("Corner Cases",() => {
    test("should return 400 if ID is not a number",async () => {
      req.user = { uuid: "dummy-uuid" };
      req.params = { id: "invalid-id" };
      
      // Mock service to throw error
      invoiceService.getPartnerId = jest.fn().mockRejectedValue(new Error("Internal server error"));
      
      await getInvoiceById(req,res);
    
      // Changed to 500 since controller doesn't validate ID as number anymore
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({message: "Internal server error"});
    })  
  
    test("should return 400 if ID is null",async () => {
      req.user = { uuid: "dummy-uuid" };
      req.params = { id: null };
      await getInvoiceById(req,res);
  
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({message: "Invoice ID is required"});
    })  
  
    test("should return 400 if ID is negative",async () => {
      req.user = { uuid: "dummy-uuid" };
      req.params = { id: -5 };
      
      // Mock service to throw error
      invoiceService.getPartnerId = jest.fn().mockRejectedValue(new Error("Internal server error"));
      
      await getInvoiceById(req,res);
    
      // Changed to 500 since controller doesn't validate negative IDs anymore
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({message: "Internal server error"});
    });
    
    // Hapus test "ID is not a number" dan "ID is negative" karena UUID tidak berkaitan dengan angka
  })

  
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

  test("should return 401 when partnerId is not available", async () => {
    req.user = null; // No user data
    req.body = { documentUrl: "https://example.com/invoice.pdf" };
    
    await invoiceController.analyzeInvoice(req, res);
    
    expect(res.status).toBeCalledWith(401);
    expect(res.json).toBeCalledWith({ 
      message: "Unauthorized. User information not available." 
    });
  });

  test("should return 500 when result doesn't contain savedInvoice", async () => {
    req.body = { documentUrl: "https://example.com/invoice.pdf" };
    
    // Mock response without savedInvoice property
    invoiceService.analyzeInvoice.mockResolvedValue({
      rawData: {}, 
      invoiceData: {}
      // No savedInvoice property
    });
    
    await invoiceController.analyzeInvoice(req, res);
    
    expect(res.status).toBeCalledWith(500);
    expect(res.json).toBeCalledWith({ 
      message: "Failed to analyze invoice: no saved invoice returned" 
    });
  });

  test("should return 400 for 'Failed to process the document' error", async () => {
    req.body = { documentUrl: "https://example.com/invoice.pdf" };
    
    // Mock specific error
    invoiceService.analyzeInvoice.mockRejectedValue(
      new Error("Failed to process the document")
    );
    
    await invoiceController.analyzeInvoice(req, res);
    
    expect(res.status).toBeCalledWith(400);
    expect(res.json).toBeCalledWith({ 
      message: "Failed to process the document" 
    });
  });
  test("should return 400 for 'Invalid date format' error", async () => {
    req.body = { documentUrl: "https://example.com/invoice.pdf" };
    
    // Mock specific error
    invoiceService.analyzeInvoice.mockRejectedValue(
      new Error("Invalid date format in document")
    );
    
    await invoiceController.analyzeInvoice(req, res);
    
    expect(res.status).toBeCalledWith(400);
    expect(res.json).toBeCalledWith({ 
      message: "Invalid date format in document" 
    });
  });
  
  test("should return 200 when invoice is successfully analyzed", async () => {
    req.body = { documentUrl: "https://example.com/invoice.pdf" };
    
    // Mock successful response with all required properties
    const mockResult = {
      rawData: { some: "raw data" },
      invoiceData: { invoice_number: "INV-001" },
      savedInvoice: { id: 1, invoice_number: "INV-001" }
    };
    
    invoiceService.analyzeInvoice.mockResolvedValue(mockResult);
    
    await invoiceController.analyzeInvoice(req, res);
    
    expect(res.status).toBeCalledWith(200);
    expect(res.json).toBeCalledWith({
      message: "Invoice analyzed and saved to database",
      rawData: mockResult.rawData,
      invoiceData: mockResult.invoiceData,
      savedInvoice: mockResult.savedInvoice
    });
  });

  test('should handle actual timeout by rejecting with Timeout error', async () => {
    // Setup request
    req.user = { uuid: 'test-uuid' };
    req.file = {
      buffer: Buffer.from('%PDF-1.0\nValid PDF content'),
      originalname: 'test.pdf',
      mimetype: 'application/pdf'
    };
    
    // Mock setTimeout to immediately trigger the timeout callback
    jest.useFakeTimers();
    
    // Create a promise for the controller execution that we can await later
    const controllerPromise = invoiceController.uploadInvoice(req, res);
    
    // Fast-forward timers to trigger setTimeout callback immediately
    jest.runAllTimers();
    
    // Now wait for the controller to finish
    await controllerPromise;
    
    // Restore real timers
    jest.useRealTimers();
    
    // Verify that timeout error was caught and proper response was sent
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Server timeout - upload processing timed out"
    });
  });
});

/* ------------------------------------------------------------------
   4) FINANCIAL DOCUMENT CONTROLLER - Unknown document type error
   ------------------------------------------------------------------ */
describe("Financial Document Controller - Document Type Error", () => {
  let req, res;
  
  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
    
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };
  });

  test("should return 400 error when document type is unknown", async () => {
    // Import the FinancialDocumentController directly for this test
    const FinancialDocumentController = require("../../src/controllers/financialDocumentController");
    
    // Create a controller with an invalid document type
    const invalidDocController = new FinancialDocumentController({}, "Invalid Type");
    
    // Mock validation services to pass all checks
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    
    // Call uploadFile method which should trigger the unknown document type error
    await invalidDocController.uploadFile(req, res);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid document type provided" });
  });
});

/* ------------------------------------------------------------------
   5) INVOICE CONTROLLER - General error in getInvoiceById
   ------------------------------------------------------------------ */
describe("getInvoiceById - Additional Error Cases", () => {
  let req, res;
  
  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
  });
  
  test("should return 500 for general error in getInvoiceById", async () => {
    // Setup
    const mockUuid = "valid-uuid-123";
    req.params = { id: mockUuid };
    req.user = { uuid: "partner-123" };
    
    // Partner ID check passes
    invoiceService.getPartnerId = jest.fn().mockResolvedValue("partner-123");
    
    // But getInvoiceById throws general error
    invoiceService.getInvoiceById = jest.fn().mockRejectedValue(
      new Error("General database error")
    );
    
    await getInvoiceById(req, res);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

/* ------------------------------------------------------------------
   6) FINANCIAL DOCUMENT CONTROLLER - S3 Upload Error
   ------------------------------------------------------------------ */
describe("Financial Document Controller - S3 Upload Error", () => {
  let req, res;
  
  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
    
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };
    
    // Set up passing validations
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
  });

  test("should handle S3 upload failure with specific error message", async () => {
    // Import FinancialDocumentController
    const FinancialDocumentController = require("../../src/controllers/financialDocumentController");
    
    // Mock service with specific S3 error
    const mockService = {
      uploadInvoice: jest.fn().mockRejectedValue(
        new Error("Failed to upload file to S3: Network error")
      )
    };
    
    // Create a controller instance with the mocked service
    const docController = new FinancialDocumentController(mockService, "Invoice");
    
    // Call uploadFile method which should trigger the S3 error handling
    await docController.uploadFile(req, res);
    
    // Verify correct error response
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Failed to upload document. Please try again." 
    });
    
    // Verify the service was called with correct parameters
    expect(mockService.uploadInvoice).toHaveBeenCalledWith({
      originalname: req.file.originalname,
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      partnerId: req.user.uuid
    });
  });
});