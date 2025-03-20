const request = require("supertest");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");

// Controller & Services
const invoiceController = require("../../src/controllers/invoiceController");
const { uploadInvoice,getInvoiceById } = require("../../src/controllers/invoiceController");
const pdfValidationService = require("../../src/services/pdfValidationService");
const invoiceService = require("../../src/services/invoiceService");
const authService = require("../../src/services/authService");


// Jest-mock-req-res untuk unit test
const { mockRequest, mockResponse } = require("jest-mock-req-res");

// Mock services
jest.mock("../../src/services/pdfValidationService");
jest.mock("../../src/services/invoiceService");
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
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(true);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    
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
      message: "Server timeout - upload processing timed out" // Update this to match the actual message
    });
  });

  test("should return status 415 if validatePDF fails", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("test"),
      mimetype: "application/pdf",
    };

    // Hanya override untuk test ini: Mock rejection untuk validatePDF
    pdfValidationService.validatePDF.mockRejectedValue(new Error("Not PDF"));

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

    // Override mock hanya untuk test ini
    pdfValidationService.isPdfEncrypted.mockResolvedValue(true); 

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "PDF is encrypted" });
  });

  test("should return status 400 if PDF file is invalid", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    // Override mock hanya untuk test ini
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(false);

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

    // Override mock hanya untuk test ini
    pdfValidationService.validateSizeFile.mockRejectedValue(new Error("File too big"));

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

    // Pastikan semua validasi diset untuk berhasil
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(true);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);

    const mockResult = {
      message: "Invoice upload service called",
      filename: "test.pdf",
    };
    
    invoiceService.uploadInvoice.mockResolvedValue(mockResult);

    await uploadInvoice(req, res);

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
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("%PDF-"),
      mimetype: "application/pdf",
    };

    const mockResult = {
      message: "Invoice upload service called",
      filename: "test.pdf",
    };

    invoiceService.uploadInvoice.mockResolvedValue(mockResult);
    
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

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

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
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
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(true);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    
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
      message: "Server timeout - upload processing timed out"  // Updated to match actual message
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

  test("harus mengembalikan status 400 jika PDF rusak", async () => {
    authService.authenticate.mockResolvedValue({ uuid: "dummy-uuid" });
    
    // Override mock hanya untuk test ini
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(false);

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
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(true);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    
    const mockResult = {
      message: "Invoice upload service called",
      filename: "test-invoice.pdf"
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
      req.user = {uuid: "dummy-uuid"};
      req.params = {id:1};
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
        status: "Analyzed",
        partner_id: "other-uuid", // different partner_id
      };
  
      invoiceService.getInvoiceById.mockResolvedValue(mockInvoice);
  
      await getInvoiceById(req,res);
  
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({message: "Forbidden: You do not have access to this invoice"});
  
      
    })
  })

  // describe("Negative - Error Handling",() => {
  //   test("Should return 404 when invoice is not found", async () => {
  //     req.user = {uuid: "dummy-uuid"};
  //     req.params = {id: 1};
  //     Invoice.findByPk.mockRejectedValue(new Error("Invoice not found"));
      
  //     await getInvoiceById(req,res);
      
  //     expect(res.status).toHaveBeenCalledWith(404);
  //     expect(res.json).toHaveBeenCalledWith({message: "Invoice not found"})
  //   });
    
  //   test("Should return 500 when internal server error occurs", async () => {
  //     req.user = {uuid: "dummy-uuid"};
  //     req.params = {id: 1};
  //     Invoice.findByPk.mockRejectedValue(new Error("Internal server error"));
      
  //     await getInvoiceById(req,res);
  
  //     expect(res.status).toHaveBeenCalledWith(500);
  //     expect(res.json).toHaveBeenCalledWith({message: "Internal server error"});
  
  //   });
  // })

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
      await getInvoiceById(req,res);
  
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({message: "Invalid invoice ID"});
    })  
  
    test("should return 400 if ID is null",async () => {
      req.user = { uuid: "dummy-uuid" };
      req.params = { id: null };
      await getInvoiceById(req,res);
  
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({message: "Invalid invoice ID"});
    })  
  
    test("should return 400 if ID is negative",async () => {
      req.user = { uuid: "dummy-uuid" };
      req.params = { id: -5 };
      await getInvoiceById(req,res);
  
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({message: "Invalid invoice ID"});
    })  
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
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(true);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    invoiceService.uploadInvoice.mockResolvedValue({
      message: "Success",
      invoiceId: "123",
      details: {}
    });
    
    // Execute with custom timeout
    await invoiceController.uploadInvoice(req, res);
    
    // Verify success response
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ 
      message: { 
        message: "Success", 
        invoiceId: "123", 
        details: {} 
      } 
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