const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { PurchaseOrderController } = require("@controllers/purchaseOrderController");
const purchaseOrderService = require("@services/purchaseOrder/purchaseOrderService");
const pdfValidationService = require("@services/pdfValidationService");
const validateDeletionService = require('@services/validateDeletion');
const s3Service = require('@services/s3Service');
const { PayloadTooLargeError, UnsupportedMediaTypeError, NotFoundError, ForbiddenError, AuthError, ValidationError } = require("@utils/errors");
const { of, throwError } = require('rxjs');

jest.mock("@services/purchaseOrder/purchaseOrderService");
jest.mock("@services/pdfValidationService");
jest.mock("@services/validateDeletion");
jest.mock("@services/s3Service");

describe("PurchaseOrderController constructor", () => {
  test("should throw error when invalid service is provided", () => {
    expect(() => {
      new PurchaseOrderController();
    }).toThrow('Invalid purchase order service provided');

    const invalidService = {};
    expect(() => {
      new PurchaseOrderController(invalidService);
    }).toThrow('Invalid purchase order service provided');
    
    const invalidService2 = { uploadPurchaseOrder: 'not a function' };
    expect(() => {
      new PurchaseOrderController(invalidService2);
    }).toThrow('Invalid purchase order service provided');
  });

  test("should not throw error when valid dependencies are provided", () => {
    const validService = { uploadPurchaseOrder: jest.fn() };
    const validDeps = {
      purchaseOrderService: validService,
      validateDeletionService: {},
      s3Service: {}
    };
    expect(() => {
      new PurchaseOrderController(validDeps);
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

    pdfValidationService.allValidations.mockResolvedValue(true);    

    purchaseOrderService.uploadPurchaseOrder = jest.fn().mockResolvedValue({
      message: "Purchase order uploaded successfully",
      id: "123"
    });
    purchaseOrderService.getPartnerId = jest.fn();
    purchaseOrderService.getPurchaseOrderById = jest.fn();
    purchaseOrderService.getPurchaseOrderStatus = jest.fn();
    purchaseOrderService.deletePurchaseOrderById = jest.fn().mockReturnValue(of({ message: "Purchase order successfully deleted" }));

    validateDeletionService.validatePurchaseOrderDeletion = jest.fn();

    s3Service.deleteFile = jest.fn().mockResolvedValue({ success: true });

    controller = new PurchaseOrderController({
      purchaseOrderService: purchaseOrderService,
      validateDeletionService: validateDeletionService,
      s3Service: s3Service
    });
    jest.clearAllMocks();
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

  describe("deletePurchaseOrderById", () => {
    const partnerId = "test-uuid";
    const purchaseOrderId = "po-123";
    const fileUrl = "https://s3.amazonaws.com/bucket/some-file-key.pdf";
    const fileKey = "some-file-key.pdf";

    beforeEach(() => {
      validateDeletionService.validatePurchaseOrderDeletion.mockClear();
      s3Service.deleteFile.mockClear();
      purchaseOrderService.deletePurchaseOrderById.mockClear();
      validateDeletionService.validatePurchaseOrderDeletion.mockResolvedValue({
        id: purchaseOrderId,
        partner_id: partnerId,
        file_url: fileUrl
      });
      s3Service.deleteFile.mockResolvedValue({ success: true });
      purchaseOrderService.deletePurchaseOrderById.mockReturnValue(of({ message: "Purchase order successfully deleted" }));
    });

    test("should successfully delete purchase order with S3 file", (done) => {
      const testData = setupTestData({ params: { id: purchaseOrderId } });
      Object.assign(req, testData);

      controller.deletePurchaseOrderById(req, res);

      setTimeout(() => {
        expect(validateDeletionService.validatePurchaseOrderDeletion).toHaveBeenCalledWith(partnerId, purchaseOrderId);
        expect(s3Service.deleteFile).toHaveBeenCalledWith(fileKey);
        expect(purchaseOrderService.deletePurchaseOrderById).toHaveBeenCalledWith(purchaseOrderId);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: "Purchase order successfully deleted" });
        done();
      }, 50);
    });

    test("should successfully delete purchase order without S3 file", (done) => {
      validateDeletionService.validatePurchaseOrderDeletion.mockResolvedValue({
        id: purchaseOrderId,
        partner_id: partnerId,
        file_url: null
      });
      const testData = setupTestData({ params: { id: purchaseOrderId } });
      Object.assign(req, testData);

      controller.deletePurchaseOrderById(req, res);

      setTimeout(() => {
        expect(validateDeletionService.validatePurchaseOrderDeletion).toHaveBeenCalledWith(partnerId, purchaseOrderId);
        expect(s3Service.deleteFile).not.toHaveBeenCalled();
        expect(purchaseOrderService.deletePurchaseOrderById).toHaveBeenCalledWith(purchaseOrderId);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: "Purchase order successfully deleted" });
        done();
      }, 50);
    });
  });
});