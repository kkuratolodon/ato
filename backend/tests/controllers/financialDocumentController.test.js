const FinancialDocumentController = require("@controllers/financialDocumentController");

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
});
