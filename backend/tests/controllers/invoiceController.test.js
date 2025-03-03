const { uploadInvoice } = require('../../src/controllers/invoiceController'); 
const invoiceService = require('../../src/services/invoiceServices'); 
const authService = require('../../src/services/authService');      
const { mockRequest, mockResponse } = require('jest-mock-req-res');
const path = require("path");
const mockFs = require("mock-fs");
const request = require("supertest");
const app = require("../../src/app");

jest.mock('../../src/services/authService', () => ({
  authenticate: jest.fn().mockResolvedValue(true)
}));

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

    test("Invoice upload service called success (mocked)",async() => {
        const mockFileName = "test-invoice.pdf"

        jest.spyOn(invoiceService,'uploadInvoice').mockResolvedValue({
                message: "Invoice upload service called",
                filename: mockFileName
        })

        const filePath = path.join(__dirname,'test-files',mockFileName)
        const response = await request(app)
            .post('/api/invoices/upload')
            .attach("file",filePath)
            .field("client_id", "test-id")
            .field("client_secret", "test-secret");

        expect(response.status).toBe(501);
        expect(response.body.message).toBe("Invoice upload service called");
        expect(response.body.filename).toBe(mockFileName)
    })

    test("Invoice upload service called error",async() => {
        const mockFileName = "test-invoice.pdf"

        jest.spyOn(invoiceService,'uploadInvoice').mockRejectedValue(new Error("Error"))
        
        const filePath = path.join(__dirname,'test-files',mockFileName)
        const response = await request(app)
            .post('/api/invoices/upload')
            .attach("file",filePath)
            .field("client_id", "test-id")
            .field("client_secret", "test-secret");

        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Internal server error");
    })

    test("Returns 415 when file is not a PDF", async () => {
        const mockFileName = "test-invoice.pdf";
        jest.spyOn(invoiceService, 'validatePDF').mockRejectedValue(new Error("Error"))

        const filePath = path.join(__dirname,'test-files',mockFileName)
        const response = await request(app)
            .post('/api/invoices/upload')
            .attach("file",filePath)
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
          .query({ simulateTimeout: 'true' })
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
      
      jest.spyOn(invoiceService, "validateSizeFile").mockRejectedValue(new Error("File size exceeds maximum limit"));
      
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

describe('Invoice Controller - uploadInvoice', () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    
    jest.clearAllMocks();
    
    authService.authenticate.mockResolvedValue(true);
  });

  test('should return status 400 if no file is uploaded', async () => {
    req.file = undefined; 
    req.body = { client_id: 'some_id', client_secret: 'some_secret' };

    await uploadInvoice(req, res);
    
    expect(res.json).toHaveBeenCalledWith({ message: "No file uploaded" });
  });

  test('should return status 401 if authentication fails', async () => {
    req.file = { originalname: 'test.pdf', buffer: Buffer.from('test'), mimetype: 'application/pdf' };
    req.body = { client_id: 'invalid_id', client_secret: 'invalid_secret' };

    authService.authenticate.mockResolvedValue(false);

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  test('should return status 501 and call invoiceService if authentication succeeds', async () => {
    req.file = { 
        originalname: 'test.pdf', 
        buffer: Buffer.from('%PDF-'), 
        mimetype: 'application/pdf' 
    };
    req.body = { client_id: 'valid_id', client_secret: 'valid_secret' };
    req.query = {};

    authService.authenticate = jest.fn().mockResolvedValue(true);

    invoiceService.validatePDF = jest.fn().mockResolvedValue(true);
    invoiceService.isPdfEncrypted = jest.fn().mockResolvedValue(false);
    invoiceService.checkPdfIntegrity = jest.fn().mockResolvedValue(true);
    invoiceService.validateSizeFile = jest.fn().mockResolvedValue(true);
    invoiceService.uploadInvoice = jest.fn().mockResolvedValue({
      message: 'Invoice upload service called',
      filename: 'test.pdf'
    });

    await uploadInvoice(req, res);

    expect(authService.authenticate).toHaveBeenCalledWith('valid_id', 'valid_secret');
    expect(invoiceService.uploadInvoice).toHaveBeenCalledWith(req.file);
    expect(res.status).toHaveBeenCalledWith(501);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invoice upload service called',
      filename: 'test.pdf'
    });
  });


  test('should return status 500 if an error occurs during authentication', async () => {
    req.file = { originalname: 'test.pdf', buffer: Buffer.from('test'), mimetype: 'application/pdf' };
    req.body = { client_id: 'any_id', client_secret: 'any_secret' };

    authService.authenticate.mockRejectedValue(new Error('Test error'));

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});