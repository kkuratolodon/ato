const FinancialDocumentController = require("@controllers/financialDocumentController");
const { ValidationError, AuthError, ForbiddenError, PayloadTooLargeError, UnsupportedMediaTypeError, NotFoundError } = require("@utils/errors");

describe("FinancialDocumentController", () => {
  let controller;
  let mockService;
  let mockReq;

  beforeEach(() => {
    mockService = {};
    controller = new FinancialDocumentController(
      mockService,
      "anyDocumentType"
    );
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

  describe("handleError", () => {
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
});
