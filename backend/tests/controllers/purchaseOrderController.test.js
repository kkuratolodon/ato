const { mockRequest, mockResponse } = require("jest-mock-req-res");
const purchaseOrderController = require("../../src/controllers/purchaseOrderController");
const purchaseOrderService = require("../../src/services/purchaseOrderService");
const pdfValidationService = require("../../src/services/pdfValidationService");
const authService = require("../../src/services/authService");
const path = require("path");

jest.mock("../../src/services/PurchaseOrderService");
jest.mock("../../src/services/pdfValidationService");
jest.mock("../../src/services/authService");

describe("Purchase Order Controller - uploadPurchaseOrder (Unit Test)", () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();

    // Default: valid file passes all validation checks
    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(true);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);

    authService.authenticate.mockResolvedValue(true);

    purchaseOrderService.uploadPurchaseOrder.mockResolvedValue({
      message: "Purchase order service called",
      filename: "test.pdf",
    });
  });

  test("should return 401 if req.user is not defined", async () => {
    req.user = undefined;
    req.file = { originalname: "test.pdf" };

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  test("should return 400 if no file is uploaded", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = undefined;

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No file uploaded" });
  });

  test("should return 504 if processing time exceeds timeout", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = { 
        originalname: "test.pdf",
        buffer: Buffer.from("dummy content"),
        mimetype: "application/pdf"
      };
    req.query = { simulateTimeout: "true" };

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({
      message: "Server timeout - upload exceeded 3 seconds",
    });
  });

  test("should return 415 if validatePDF fails", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = {
      originalname: "test.pdf",
      buffer: Buffer.from("test"),
      mimetype: "application/pdf",
    };

    pdfValidationService.validatePDF.mockRejectedValue(new Error("Not PDF"));

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({ message: "File format is not PDF" });
  });

  test("should return 400 if PDF is encrypted", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = { originalname: "test.pdf", buffer: Buffer.from("%PDF-"), mimetype: "application/pdf" };

    pdfValidationService.isPdfEncrypted.mockResolvedValue(true);

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "PDF is encrypted" });
  });

  test("should return 400 if PDF file is invalid", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = { originalname: "test.pdf", buffer: Buffer.from("%PDF-"), mimetype: "application/pdf" };

    pdfValidationService.checkPdfIntegrity.mockResolvedValue(false);

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "PDF file is invalid" });
  });

  test("should return 413 if file size is too large", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = { originalname: "test.pdf", buffer: Buffer.from("%PDF-"), mimetype: "application/pdf" };

    pdfValidationService.validateSizeFile.mockRejectedValue(new Error("File too big"));

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ message: "File size exceeds maximum limit" });
  });

  test("should return 200 if file upload is successful", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = { originalname: "test.pdf", buffer: Buffer.from("%PDF-"), mimetype: "application/pdf" };

    pdfValidationService.validatePDF.mockResolvedValue(true);
    pdfValidationService.isPdfEncrypted.mockResolvedValue(false);
    pdfValidationService.checkPdfIntegrity.mockResolvedValue(true);
    pdfValidationService.validateSizeFile.mockResolvedValue(true);

    const mockResult = {
      message: "Purchase order service called",
      filename: "test.pdf",
    };

    purchaseOrderService.uploadPurchaseOrder.mockResolvedValue(mockResult);

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  test("should return 500 if unexpected error occurs", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = { originalname: "test.pdf", buffer: Buffer.from("%PDF-"), mimetype: "application/pdf" };

    purchaseOrderService.uploadPurchaseOrder.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });

  test("should handle timeout errors properly", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = { originalname: "test.pdf", buffer: Buffer.from("%PDF-"), mimetype: "application/pdf" };

    jest.useFakeTimers();
    purchaseOrderService.uploadPurchaseOrder.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ message: "This should not be called" });
        }, 4000);
      });
    });

    const uploadPromise = purchaseOrderController.uploadPurchaseOrder(req, res);
    jest.advanceTimersByTime(3100);
    await uploadPromise;

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({ message: "Server timeout - upload exceeded 3 seconds" });

    jest.useRealTimers();
  });

  test("should clear timeout when function completes before timeout", async () => {
    req.user = { uuid: "dummy-uuid" };
    req.file = { originalname: "test.pdf", buffer: Buffer.from("%PDF-"), mimetype: "application/pdf" };

    const mockResult = {
      message: "Purchase order service called",
      filename: "test.pdf",
    };

    purchaseOrderService.uploadPurchaseOrder.mockResolvedValue(mockResult);
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockResult);
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

        purchaseOrderService.uploadPurchaseOrder.mockImplementation(() => {
        throw new Error("Something unexpected happened");
        });

        await purchaseOrderController.uploadPurchaseOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
    });

  test("should not send a response if headersSent is already true", async () => {
    const req = { user: null, file: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), headersSent: true };

    await purchaseOrderController.uploadPurchaseOrder(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
