const FinancialDocumentController = require("@controllers/financialDocumentController");
const { ValidationError, AuthError, ForbiddenError, PayloadTooLargeError, UnsupportedMediaTypeError, NotFoundError } = require("@utils/errors");

describe("FinancialDocumentController", () => {
  let controller;
  let mockService;
  let mockReq;
  let mockPdfDecryptionService;

  beforeEach(() => {
    mockService = {};
    mockPdfDecryptionService = {
      decrypt: jest.fn()
    };
    controller = new FinancialDocumentController(
      mockService,
      "anyDocumentType"
    );
    // Replace the controller's PDF decryption service with our mock
    controller.pdfDecryptionService = mockPdfDecryptionService;
    
    mockReq = {
      user: { id: 1 },
      file: {
        buffer: Buffer.from("test"),
        mimetype: "application/pdf",
        originalname: "test.pdf",
      },
    };
  });

  describe("processUpload", () => {
    test("should throw error when not implemented", async () => {

      await expect(controller.processUpload(mockReq)).rejects.toThrow(
        "processUpload must be implemented by child classes"
      );
    });
  });

  describe("validateUploadFile", () => {
    test("should detect encrypted PDF and return appropriate status", async () => {
      // Mock the pdfValidationService
      const pdfValidationService = require("../../src/services/pdfValidationService");
      jest.spyOn(pdfValidationService, "allValidations").mockResolvedValue({
        isValid: true,
        isEncrypted: true
      });

      const result = await controller.validateUploadFile(mockReq.file);
      
      expect(result).toEqual({
        isEncrypted: true,
        buffer: mockReq.file.buffer,
        filename: mockReq.file.originalname
      });
    });
  });

  describe("uploadFile", () => {
    test("should handle encrypted PDF with valid password", async () => {
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      
      // Mock validateUploadRequest to do nothing
      jest.spyOn(controller, "validateUploadRequest").mockResolvedValue(undefined);
      
      // Mock validateUploadFile to return an encrypted status
      jest.spyOn(controller, "validateUploadFile").mockResolvedValue({
        isEncrypted: true,
        buffer: Buffer.from("encrypted content"),
        filename: "encrypted.pdf"
      });
      
      // Add password to request
      mockReq.body = { password: "correct-password" };
      
      // Mock successful decryption
      const decryptedBuffer = Buffer.from("decrypted content");
      mockPdfDecryptionService.decrypt.mockResolvedValue(decryptedBuffer);
      
      // Mock processUpload to return success
      jest.spyOn(controller, "processUpload").mockResolvedValue({ success: true, data: "processed data" });
      
      await controller.uploadFile(mockReq, mockRes);
      
      // Verify decryption was called with correct parameters
      expect(mockPdfDecryptionService.decrypt).toHaveBeenCalledWith(
        Buffer.from("encrypted content"), 
        "correct-password"
      );
      
      // Verify the decrypted buffer was used for processing
      expect(mockReq.file.buffer).toEqual(decryptedBuffer);
      
      // Verify the response, with 'message' wrapping expected
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        message: { success: true, data: "processed data" } 
      });
    });

    test("should return 403 for encrypted PDF without password", async () => {
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      
      // Mock validateUploadRequest to do nothing
      jest.spyOn(controller, "validateUploadRequest").mockResolvedValue(undefined);
      
      // Mock validateUploadFile to return an encrypted status
      jest.spyOn(controller, "validateUploadFile").mockResolvedValue({
        isEncrypted: true,
        buffer: Buffer.from("encrypted content"),
        filename: "encrypted.pdf"
      });
      
      // No password in request
      mockReq.body = {};
      
      await controller.uploadFile(mockReq, mockRes);
      
      // Verify the response asks for password, with 'message' wrapping expected
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: {
          message: "PDF is encrypted and requires a password",
          requiresPassword: true
        }
      });
    });

    test("should handle incorrect password for encrypted PDF", async () => {
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      
      // Mock validateUploadRequest to do nothing
      jest.spyOn(controller, "validateUploadRequest").mockResolvedValue(undefined);
      
      // Mock validateUploadFile to return an encrypted status
      jest.spyOn(controller, "validateUploadFile").mockResolvedValue({
        isEncrypted: true,
        buffer: Buffer.from("encrypted content"),
        filename: "encrypted.pdf"
      });
      
      // Add incorrect password to request
      mockReq.body = { password: "wrong-password" };
      
      // Mock failed decryption due to incorrect password
      mockPdfDecryptionService.decrypt.mockRejectedValue(new Error("Incorrect password"));
      
      await controller.uploadFile(mockReq, mockRes);
      
      // Verify the response indicates incorrect password
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Incorrect password for encrypted PDF"
      });
    });

    test("should handle general decryption errors with meaningful message", async () => {
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      
      // Mock validateUploadRequest to do nothing
      jest.spyOn(controller, "validateUploadRequest").mockResolvedValue(undefined);
      
      // Mock validateUploadFile to return an encrypted status
      jest.spyOn(controller, "validateUploadFile").mockResolvedValue({
        isEncrypted: true,
        buffer: Buffer.from("encrypted content"),
        filename: "encrypted.pdf"
      });
      
      // Add password to request
      mockReq.body = { password: "any-password" };
      
      // Mock decryption service to throw a general error (not password-related)
      const decryptionError = new Error("Corrupted file");
      mockPdfDecryptionService.decrypt.mockRejectedValue(decryptionError);
      
      await controller.uploadFile(mockReq, mockRes);
      
      // Verify the response has the proper error message format
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Failed to decrypt PDF: Corrupted file"
      });
    });
  });

  describe("handleError", () => {
    test("should return 400 for ValidationError", () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const error = new ValidationError("Validation error");

      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Validation error" });
    });

    test("should return 401 for AuthError", () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const error = new AuthError("Unauthorized");

      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    });

    test("should return 403 for ForbiddenError", () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const error = new ForbiddenError("Forbidden");

      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
    });

    test("should return 404 for NotFoundError", () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const error = new NotFoundError("Not found");

      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Not found" });
    });

    test("should return 413 for PayloadTooLargeError", () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const error = new PayloadTooLargeError("Payload too large");

      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({ message: "Payload too large" });
    });

    test("should return 415 for UnsupportedMediaTypeError", () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const error = new UnsupportedMediaTypeError("Unsupported media type");

      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.json).toHaveBeenCalledWith({ message: "Unsupported media type" });
    });

    test("should return 504 for Timeout error", () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const error = new Error("Timeout");

      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith({ message: "Server timeout - upload processing timed out" });
    });

    test("should return 500 for unexpected error", () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const error = new Error("Unexpected error");

      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
    });
  });
});
