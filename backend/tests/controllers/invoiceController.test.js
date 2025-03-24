const { InvoiceController } = require("../../src/controllers/invoiceController");
const pdfValidationService = require("../../src/services/pdfValidationService");
// const invoiceService = require("../../src/services/mockInvoiceService");
const { mockRequest, mockResponse } = require("jest-mock-req-res");

// Mock services
jest.mock("../../src/services/pdfValidationService");
// jest.mock("../../src/services/invoiceService");

describe("Invoice Controller", () => {
  let req, res, controller, mockInvoiceService;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();

    mockInvoiceService = {
      uploadInvoice: jest.fn(),
      getInvoiceById: jest.fn(), 
      getPartnerId: jest.fn()
    }; 

    controller = new InvoiceController(mockInvoiceService); 
    jest.clearAllMocks();

    // Set default mocks
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(true);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    
    mockInvoiceService.uploadInvoice.mockResolvedValue({
      message: "Invoice upload success",
      invoiceId: "123"
    });
  });

  describe("uploadInvoice", () => {
    test("should successfully upload when all validations pass", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: {
          message: "Invoice upload success",
          invoiceId: "123"
        }
      });
    });

    test("should return 401 when user is not authenticated", async () => {
      req.user = undefined;
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
      };

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized"
      });
    });

    test("should return 400 when no file uploaded", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = undefined;

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "No file uploaded"
      });
    });
    
    test("should return 400 when PDF validation fails", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

      pdfValidationService.validatePDF.mockRejectedValue(new Error("Invalid PDF"));

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid PDF"
      });
    }); 

    test("should handle timeout and return 504", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

      // Simulate timeout
      mockInvoiceService.uploadInvoice.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 4000))
      );

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith({
        message: "Server timeout - upload processing timed out"
      });
    });

    test("should return 500 for unexpected internal server errors", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

      mockInvoiceService.uploadInvoice.mockRejectedValue(new Error("Internal server error"));

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error"
      }); 
    });
  }); 

  describe("getInvoiceById", () => {
    test("should return invoice when authorized", async () => {
      const mockInvoice = {
        id: 1,
        partnerId: "test-uuid",
        total: 100
      };

      req.user = { uuid: "test-uuid" };
      req.params = { id: "1" };

      mockInvoiceService.getPartnerId.mockResolvedValue("test-uuid");
      mockInvoiceService.getInvoiceById.mockResolvedValue(mockInvoice);

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockInvoice);
    });

    test("should return 401 when user is not authenticated", async () => {
      req.user = undefined;
      req.params = { id: "1" };

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized"
      });
    });

    test("should return 403 when accessing another user's invoice", async () => {
      req.user = { uuid: "test-uuid" };
      req.params = { id: "1" };

      mockInvoiceService.getPartnerId.mockResolvedValue("other-uuid");

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "You do not have access to this invoice"
      });
    });

    test("should return 404 when invoice not found", async () => {
      req.user = { uuid: "test-uuid" };
      req.params = { id: "1" };

      mockInvoiceService.getPartnerId.mockResolvedValue("test-uuid");
      mockInvoiceService.getInvoiceById.mockResolvedValue(null);

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invoice not found"
      });
    }); 

    test("should return 500 for unexpected internal server errors", async () => {
      req.user = { uuid: "test-uuid" };
      req.params = { id: "1" };

      mockInvoiceService.getPartnerId.mockRejectedValue(new Error("Internal server error"));

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error"
      });
    });

    test("should return 400 when invoice ID is null", async () => {
      req.user = { uuid: "test-uuid" };
      req.params = { id: null };

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid invoice ID"
      });
    }); 

    test("should return 400 when invoice ID is not a number", async () => {
      req.user = { uuid: "test-uuid" };
      req.params = { id: "abc" };

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid invoice ID"
      });
    }); 

    test("should return 400 when invoice ID is negative", async () => {
      req.user = { uuid: "test-uuid" };
      req.params = { id: "-1" };

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid invoice ID"
      });
    }); 
  });
});