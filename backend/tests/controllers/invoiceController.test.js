const { InvoiceController } = require("../../src/controllers/invoiceController");
const pdfValidationService = require("../../src/services/pdfValidationService");

// Jest-mock-req-res untuk unit test
const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { PayloadTooLargeError, UnsupportedMediaTypeError, NotFoundError } = require("../../src/utils/errors");

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
      getPartnerId: jest.fn(),
      deleteInvoiceById: jest.fn(),  // Add this method that might be needed
      getInvoiceStatus: jest.fn()
    };

    // Create mock services for other dependencies
    const mockValidateDeletionService = {
      validateInvoiceDeletion: jest.fn()
    };

    const mockStorageService = {
      deleteFile: jest.fn().mockResolvedValue({ success: true })
    };

    // Change this line to pass a dependencies object
    controller = new InvoiceController({
      invoiceService: mockInvoiceService,
      validateDeletionService: mockValidateDeletionService,
      storageService: mockStorageService
    });

    pdfValidationService.allValidations.mockResolvedValue(true);
    jest.clearAllMocks();
  });
  // Add this at the beginning of your tests in invoiceController.test.js
  describe("Invoice Controller constructor", () => {
    test("should throw error when invalid service is provided", () => {
      // Case 1: No dependencies provided
      expect(() => {
        new InvoiceController();
      }).toThrow('Invalid invoice service provided');

      // Case 2: No invoiceService provided
      expect(() => {
        new InvoiceController({});
      }).toThrow('Invalid invoice service provided');

      // Case 3: invoiceService with non-function uploadInvoice
      expect(() => {
        new InvoiceController({
          invoiceService: { uploadInvoice: "not a function" }
        });
      }).toThrow('Invalid invoice service provided');
    });

    test("should not throw error when valid service is provided", () => {
      const validService = {
        uploadInvoice: jest.fn()
      };

      expect(() => {
        new InvoiceController({
          invoiceService: validService,
          validateDeletionService: {},
          s3Service: {}
        });
      }).not.toThrow();
    });
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

    test("should successfully upload with skipAnalysis set to true", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);
      // Fix the test to match what we expect in the real application
      req.body = { 'skipAnalysis': 'true' }; // No space - this is what we expect from well-behaved clients
      
      await controller.uploadInvoice(req, res);

      expect(mockInvoiceService.uploadInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          originalname: "test.pdf",
          mimetype: "application/pdf",
          partnerId: "test-uuid"
        }),
        true  // skipAnalysis should be true
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    // Add test for the case with a space in the parameter name
    test("should handle skipAnalysis parameter with space in name", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);
      // Set parameter with space at the end to simulate the problematic case
      req.body = { 'skipAnalysis ': 'true' }; 
      
      await controller.uploadInvoice(req, res);

      expect(mockInvoiceService.uploadInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          originalname: "test.pdf",
          mimetype: "application/pdf",
          partnerId: "test-uuid"
        }),
        true  // skipAnalysis should still be detected as true
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should default skipAnalysis to false when not provided", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);
      // No skipAnalysis in body

      await controller.uploadInvoice(req, res);

      expect(mockInvoiceService.uploadInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          originalname: "test.pdf",
          mimetype: "application/pdf",
          partnerId: "test-uuid"
        }),
        false  // skipAnalysis should be false by default
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should handle skipAnalysis with value other than 'true' as false", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);
      req.body = { skipAnalysis: 'yes' };  // Not exactly 'true'

      await controller.uploadInvoice(req, res);

      expect(mockInvoiceService.uploadInvoice).toHaveBeenCalledWith(
        expect.any(Object),
        false  // Should be treated as false
      );
      expect(res.status).toHaveBeenCalledWith(200);
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

    test("should handle undefined req.body and default skipAnalysis to false", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);
      // Explicitly set req.body to undefined
      req.body = undefined;
      
      await controller.uploadInvoice(req, res);

      expect(mockInvoiceService.uploadInvoice).toHaveBeenCalledWith(
        expect.any(Object),
        false  // skipAnalysis should be false when req.body is undefined
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should handle null req.body and default skipAnalysis to false", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);
      // Set req.body to null
      req.body = null;
      
      await controller.uploadInvoice(req, res);

      expect(mockInvoiceService.uploadInvoice).toHaveBeenCalledWith(
        expect.any(Object),
        false  // skipAnalysis should be false when req.body is null
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should handle non-object req.body and default skipAnalysis to false", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);
      // Set req.body to a string (non-object)
      req.body = "not an object";
      
      await controller.uploadInvoice(req, res);

      expect(mockInvoiceService.uploadInvoice).toHaveBeenCalledWith(
        expect.any(Object),
        false  // skipAnalysis should be false when req.body is not an object
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should handle empty object req.body and default skipAnalysis to false", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);
      // Set req.body to an empty object
      req.body = {};
      
      await controller.uploadInvoice(req, res);

      expect(mockInvoiceService.uploadInvoice).toHaveBeenCalledWith(
        expect.any(Object),
        false  // skipAnalysis should be false when req.body is an empty object
      );
      expect(res.status).toHaveBeenCalledWith(200);
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
        message: "Forbidden: You do not have access to this invoice"
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
        message: "Invoice ID is required"
      });
    });

  });

  describe("getInvoiceStatus", () => {
    test("should return invoice status when authorized", async () => {
      // Arrange
      const mockStatus = {
        id: "1",
        status: "ANALYZED"
      };
      const testData = setupTestData();
      Object.assign(req, testData);

      mockInvoiceService.getPartnerId.mockResolvedValue("test-uuid");
      mockInvoiceService.getInvoiceStatus.mockResolvedValue(mockStatus);

      // Act
      await controller.getInvoiceStatus(req, res);

      // Assert
      expect(mockInvoiceService.getPartnerId).toHaveBeenCalledWith("1");
      expect(mockInvoiceService.getInvoiceStatus).toHaveBeenCalledWith("1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockStatus);
    });

    test("should return 401 when user is not authenticated", async () => {
      // Arrange
      const testData = setupTestData({ user: undefined });
      Object.assign(req, testData);

      // Act
      await controller.getInvoiceStatus(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized"
      });
      expect(mockInvoiceService.getInvoiceStatus).not.toHaveBeenCalled();
    });

    test("should return 400 when invoice ID is missing", async () => {
      // Arrange
      const testData = setupTestData({ params: {} });
      Object.assign(req, testData);

      // Act
      await controller.getInvoiceStatus(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invoice ID is required"
      });
      expect(mockInvoiceService.getInvoiceStatus).not.toHaveBeenCalled();
    });

    test("should return 403 when accessing another user's invoice", async () => {
      // Arrange
      const testData = setupTestData();
      Object.assign(req, testData);

      mockInvoiceService.getPartnerId.mockResolvedValue("other-uuid");

      // Act
      await controller.getInvoiceStatus(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Forbidden: You do not have access to this invoice"
      });
      expect(mockInvoiceService.getInvoiceStatus).not.toHaveBeenCalled();
    });

    test("should handle invoice not found error", async () => {
      // Arrange
      const testData = setupTestData();
      Object.assign(req, testData);

      mockInvoiceService.getPartnerId.mockResolvedValue("test-uuid");
      // Use NotFoundError instead of generic Error
      mockInvoiceService.getInvoiceStatus.mockRejectedValue(new NotFoundError("Invoice not found"));

      // Act
      await controller.getInvoiceStatus(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invoice not found"
      });
    });

  });
});