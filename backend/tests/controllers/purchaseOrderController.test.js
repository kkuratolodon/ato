const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { PurchaseOrderController } = require("../../src/controllers/purchaseOrderController");
const purchaseOrderService = require("../../src/services/purchaseOrder/purchaseOrderService");
const pdfValidationService = require("../../src/services/pdfValidationService");
const { PayloadTooLargeError, UnsupportedMediaTypeError } = require("../../src/utils/errors");

jest.mock("../../src/services/purchaseOrder/purchaseOrderService");
jest.mock("../../src/services/pdfValidationService");

describe("PurchaseOrderController constructor", () => {
  test("should throw error when invalid service is provided", () => {
    // Case 1: No service provided
    expect(() => {
      new PurchaseOrderController();
    }).toThrow('Invalid purchase order service provided');

    // Case 2: Service without uploadPurchaseOrder function
    const invalidService = {};
    expect(() => {
      new PurchaseOrderController(invalidService);
    }).toThrow('Invalid purchase order service provided');
    
    // Case 3: Service with non-function uploadPurchaseOrder property
    const invalidService2 = { uploadPurchaseOrder: 'not a function' };
    expect(() => {
      new PurchaseOrderController(invalidService2);
    }).toThrow('Invalid purchase order service provided');
  });

  test("should not throw error when valid service is provided", () => {
    const validService = { uploadPurchaseOrder: jest.fn() };
    expect(() => {
      new PurchaseOrderController(validService);
    }).not.toThrow();
  });
});

describe("Purchase Order Controller", () => {
  let req, res, controller;

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

    // Default mocks
    pdfValidationService.allValidations.mockResolvedValue(true);    

    purchaseOrderService.uploadPurchaseOrder = jest.fn().mockResolvedValue({
      message: "Purchase order uploaded successfully",
      id: "123"
    });
    purchaseOrderService.getPartnerId = jest.fn();

    controller = new PurchaseOrderController(purchaseOrderService);
    jest.clearAllMocks();
  });

  // Add this new test to cover the constructor validation (line 8)
  describe("constructor", () => {
    test("should throw an error when an invalid service is provided", () => {
      // Test with null
      expect(() => new PurchaseOrderController(null)).toThrow('Invalid purchase order service provided');
      
      // Test with undefined
      expect(() => new PurchaseOrderController(undefined)).toThrow('Invalid purchase order service provided');
      
      // Test with an object that doesn't have the required method
      const invalidService = { 
        someOtherMethod: () => {} 
      };
      expect(() => new PurchaseOrderController(invalidService)).toThrow('Invalid purchase order service provided');
    });

    test("should create controller successfully with valid service", () => {
      // Create a mock service with the required method
      const validService = {
        uploadPurchaseOrder: jest.fn()
      };
      
      // This should not throw an error
      const controller = new PurchaseOrderController(validService);
      expect(controller).toBeInstanceOf(PurchaseOrderController);
    });
  });

  describe("uploadPurchaseOrder", () => {
    test("should successfully upload when all validations pass", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      await controller.uploadPurchaseOrder(req, res);

      expect(purchaseOrderService.uploadPurchaseOrder).toHaveBeenCalledWith({
        buffer: expect.any(Buffer),
        originalname: "test.pdf",
        mimetype: "application/pdf",
        partnerId: "test-uuid"
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: {
          message: "Purchase order uploaded successfully",
          id: "123"
        }
      });
    });

    test("should return 401 when user is not authenticated", async () => {
      const testData = setupTestData({ user: undefined });
      Object.assign(req, testData);

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized"
      });
      expect(purchaseOrderService.uploadPurchaseOrder).not.toHaveBeenCalled();
    });

    test("should return 400 when no file uploaded", async () => {
      const testData = setupTestData({ file: undefined });
      Object.assign(req, testData);

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "No file uploaded"
      });
    });

    test("should return 400 when PDF validation fails", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      pdfValidationService.allValidations.mockRejectedValue(new Error("Invalid PDF"));

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid PDF"
      });
    });

    test("should handle timeout and return 504", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      // Simulate timeout
      purchaseOrderService.uploadPurchaseOrder.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 4000))
      );

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith({
        message: "Server timeout - upload processing timed out"
      });
    });

    test("should return 500 for unexpected internal server errors", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      purchaseOrderService.uploadPurchaseOrder.mockRejectedValue(new Error("Internal server error"));

      await controller.uploadPurchaseOrder(req, res);

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

      await controller.uploadPurchaseOrder(req, res);

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

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only PDF files are allowed"
      });
    });
  });

  describe("getPurchaseOrderById", () => {
    beforeEach(() => {
      purchaseOrderService.getPurchaseOrderById = jest.fn();
    });
    
    test("should return purchase order when authorized", async () => {
      const mockPurchaseOrder = {
        id: "po-123",
        data: {
          documents: [{
            header: {
              purchase_order_details: {
                purchase_order_id: "PO-2024-001"
              }
            }
          }]
        }
      };
      const testData = setupTestData();
      Object.assign(req, testData);

      purchaseOrderService.getPartnerId.mockResolvedValue("test-uuid");
      purchaseOrderService.getPurchaseOrderById.mockResolvedValue(mockPurchaseOrder);

      await controller.getPurchaseOrderById(req, res);

      expect(purchaseOrderService.getPartnerId).toHaveBeenCalledWith("1");
      expect(purchaseOrderService.getPurchaseOrderById).toHaveBeenCalledWith("1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPurchaseOrder);
    });

    test("should return 401 when user is not authenticated", async () => {
      const testData = setupTestData({ user: undefined });
      Object.assign(req, testData);

      await controller.getPurchaseOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized"
      });
      expect(purchaseOrderService.getPurchaseOrderById).not.toHaveBeenCalled();
    });

    test("should return 400 when purchase order ID is null", async () => {
      const testData = setupTestData({ params: { id: null } });
      Object.assign(req, testData);

      await controller.getPurchaseOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Purchase order ID is required"
      });
      expect(purchaseOrderService.getPurchaseOrderById).not.toHaveBeenCalled();
    });

    test("should return 403 when accessing another user's purchase order", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      purchaseOrderService.getPartnerId.mockResolvedValue("other-uuid");

      await controller.getPurchaseOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Forbidden: You do not have access to this purchase order"
      });
      expect(purchaseOrderService.getPurchaseOrderById).not.toHaveBeenCalled();
    });

    test("should return 404 when purchase order not found", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      purchaseOrderService.getPartnerId.mockResolvedValue("test-uuid");
      purchaseOrderService.getPurchaseOrderById.mockResolvedValue(null);

      await controller.getPurchaseOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Purchase order not found"
      });
    });

    test("should return 500 when an unexpected error occurs", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      purchaseOrderService.getPartnerId.mockRejectedValue(new Error("Database error"));

      await controller.getPurchaseOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error"
      });
    });

    test("should return 500 when purchase order service throws an error", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      purchaseOrderService.getPartnerId.mockResolvedValue("test-uuid");
      purchaseOrderService.getPurchaseOrderById.mockRejectedValue(new Error("Service error"));

      await controller.getPurchaseOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error"
      });
    });

    test("should handle the case when getPurchaseOrderById returns undefined", async () => {
      const testData = setupTestData();
      Object.assign(req, testData);

      purchaseOrderService.getPartnerId.mockResolvedValue("test-uuid");
      purchaseOrderService.getPurchaseOrderById.mockResolvedValue(undefined);

      await controller.getPurchaseOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Purchase order not found"
      });
    });
  });
});