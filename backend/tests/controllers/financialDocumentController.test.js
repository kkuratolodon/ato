const FinancialDocumentController = require("../../src/controllers/financialDocumentController");

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
  // describe("processUpload", () => {
  //   test("should throw an error if not implemented in the child class", async () => {
  //     await expect(controller.processUpload(mockReq)).rejects.toThrow(
  //       "processUpload must be implemented by child classes"
  //     );
  //   });

    // test("should process the upload when implemented in a child class", async () => {
    //   // Mock a child class that implements processUpload
    //   class MockChildController extends FinancialDocumentController {
    //     async processUpload(req) {
    //       return {
    //         success: true,
    //         userId: req.user.id,
    //         fileName: req.file.originalname,
    //       };
    //     }
    //   }

    //   const childController = new MockChildController(
    //     mockService,
    //     "anyDocumentType"
    //   );
    //   const result = await childController.processUpload(mockReq);

    //   expect(result).toEqual({
    //     success: true,
    //     userId: mockReq.user.id,
    //     fileName: mockReq.file.originalname,
    //   });
    // });
  // });
});
