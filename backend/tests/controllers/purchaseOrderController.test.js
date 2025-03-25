const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { PurchaseOrderController } = require("../../src/controllers/purchaseOrderController");
const purchaseOrderService = require("../../src/services/purchaseOrderService");
const pdfValidationService = require("../../src/services/pdfValidationService");

jest.mock("../../src/services/purchaseOrderService");
jest.mock("../../src/services/pdfValidationService");

describe("Purchase Order Controller", () => {
  let req, res, controller;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();

    controller = new PurchaseOrderController(purchaseOrderService);
    jest.clearAllMocks();

    // Default mocks
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(true);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);
    pdfValidationService.validatePdfPageCount.mockResolvedValue(1);

    purchaseOrderService.uploadPurchaseOrder.mockResolvedValue({
      message: "Purchase order uploaded successfully",
      id: "123"
    });
  });

  describe("uploadFile", () => {
    test("should successfully upload when all validations pass", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = {
        buffer: Buffer.from("test"),
        originalname: "test.pdf",
        mimetype: "application/pdf"
      };

      await controller.uploadFile(req, res);

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

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized"
      });
      expect(purchaseOrderService.uploadPurchaseOrder).not.toHaveBeenCalled();
    });

    test("should return 400 when no file uploaded", async () => {
      req.user = { uuid: "test-uuid" };
      req.file = undefined;

      await controller.uploadFile(req, res);

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

      await controller.uploadFile(req, res);

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

      pdfValidationService.validatePDF.mockRejectedValue(
        new Error("PDF validation failed")
      );

      await controller.uploadFile(req, res);

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

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error"
      });
    });
  });
});