const { InvoiceController } = require("../../src/controllers/invoiceController");
const pdfValidationService = require("../../src/services/pdfValidationService");
// const invoiceService = require("../../src/services/mockInvoiceService");
const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { PayloadTooLargeError, UnsupportedMediaTypeError } = require("../../src/utils/errors");

// Mock services
jest.mock("../../src/services/pdfValidationService");
// jest.mock("../../src/services/invoiceService");

describe("Invoice Controller", () => {
  let req, res, controller, mockInvoiceService;

  const setupTestData = (overrides = {}) => {  
    return {  
      user: { uuid: "test-uuid" },  
      file: {  
        buffer: Buffer.from("test"),  
        originalname: "test.pdf",  
        mimetype: "application/pdf"  
      },
      params: { id: "1" },  
      ...overrides  
    };  
  };  
  
  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();

    mockInvoiceService = {
      uploadInvoice: jest.fn().mockResolvedValue({
        message: "Invoice upload success",
        invoiceId: "123"
      }),
      getInvoiceById: jest.fn(),
      getPartnerId: jest.fn()
    };

    controller = new InvoiceController(mockInvoiceService);
    pdfValidationService.allValidations.mockResolvedValue(true);
    jest.clearAllMocks();
  });

  describe("uploadInvoice", () => {
    test("should successfully upload when all validations pass", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

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
      const testData = setupTestData({ user: undefined });
      Object.assign(req, testData);

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized"
      });
    });

    test("should return 400 when no file uploaded", async () => {
      const testData = setupTestData({ file: undefined });
      Object.assign(req, testData);

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "No file uploaded"
      });
    });

    test("should return 400 when PDF validation fails", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      pdfValidationService.allValidations.mockRejectedValue(new Error("Invalid PDF"));

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid PDF"
      });
    });

    test("should handle timeout and return 504", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

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
      const testData = setupTestData();
      Object.assign(req, testData);

      mockInvoiceService.uploadInvoice.mockRejectedValue(new Error("Internal server error"));

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error"
      }); 
    });

    test("should return 413 when file is too large", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      pdfValidationService.allValidations.mockRejectedValue(
        new PayloadTooLargeError("File size exceeds 20MB limit")
      );

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({
        message: "File size exceeds 20MB limit"
      });
    });

    test("should return 415 when file is not PDF", async () => {
      const testData = setupTestData({
        file: {
          buffer: Buffer.from("test"),
          originalname: "test.jpg",
          mimetype: "image/jpeg"
        }
      });
      Object.assign(req, testData);

      pdfValidationService.allValidations.mockRejectedValue(
        new UnsupportedMediaTypeError("Only PDF files are allowed")
      );

      await controller.uploadInvoice(req, res);

      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only PDF files are allowed"
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
      const testData = setupTestData();
      Object.assign(req, testData);

      mockInvoiceService.getPartnerId.mockResolvedValue("test-uuid");
      mockInvoiceService.getInvoiceById.mockResolvedValue(mockInvoice);

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockInvoice);
    });

    test("should return 401 when user is not authenticated", async () => {
      const testData = setupTestData({ user: undefined });
      Object.assign(req, testData);

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized"
      });
    });

    test("should return 403 when accessing another user's invoice", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      mockInvoiceService.getPartnerId.mockResolvedValue("other-uuid");

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "You do not have access to this invoice"
      });
    });

    test("should return 404 when invoice not found", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      mockInvoiceService.getPartnerId.mockResolvedValue("test-uuid");
      mockInvoiceService.getInvoiceById.mockResolvedValue(null);

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invoice not found"
      });
    });

    test("should return 500 for unexpected internal server errors", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      mockInvoiceService.getPartnerId.mockRejectedValue(new Error("Internal server error"));

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error"
      });
    });

    test("should return 400 when invoice ID is null", async () => {
      const testData = setupTestData({ params: { id: null } });
      Object.assign(req, testData);

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid invoice ID"
      });
    });

    test("should return 400 when invoice ID is not a number", async () => {
      const testData = setupTestData({ params: { id: "abc" } });
      Object.assign(req, testData);

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid invoice ID"
      });
    });

    test("should return 400 when invoice ID is negative", async () => {
      const testData = setupTestData({ params: { id: "-1" } });
      Object.assign(req, testData);

      await controller.getInvoiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid invoice ID"
      });
    });
  });
});