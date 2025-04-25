const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { PurchaseOrderController } = require("@controllers/purchaseOrderController");
const purchaseOrderService = require("@services/purchaseOrder/purchaseOrderService");
const pdfValidationService = require("@services/pdfValidationService");

jest.mock("@services/purchaseOrder/purchaseOrderService");
jest.mock("@services/pdfValidationService");

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

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();

    controller = new PurchaseOrderController(purchaseOrderService);
    jest.clearAllMocks();

    // Default mocks
    pdfValidationService.allValidations.mockResolvedValue(true);    

    purchaseOrderService.uploadPurchaseOrder.mockResolvedValue({
      message: "Purchase order uploaded successfully",
      id: "123"
    });
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
      req.user = { uuid: "test-uuid" };
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

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

    test("should return 401 when unauthorized", async () => {
      req.user = undefined;
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized"
      });
      expect(purchaseOrderService.uploadPurchaseOrder).not.toHaveBeenCalled();
    });

    test("should return 400 when no file uploaded", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = undefined;

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "No file uploaded"
      });
    });

    test("should handle timeout", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

      purchaseOrderService.uploadPurchaseOrder.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 4000))
      );

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith({
        message: "Server timeout - upload processing timed out"
      });
    });

    test("should handle PDF validation errors", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

      pdfValidationService.allValidations.mockRejectedValue(
        new Error("PDF validation failed")
      );

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "PDF validation failed"
      });
    });

    test("should handle service errors", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

      purchaseOrderService.uploadPurchaseOrder.mockRejectedValue(
        new Error("Service error")
      );

      await controller.uploadPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error"
      });
    });
  });
});