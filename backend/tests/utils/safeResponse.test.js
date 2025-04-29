const { safeResponse } = require("@utils/responseHelper");

describe("safeResponse Utility Function", () => {
  
  test("should send response when headers are not sent", () => {
    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    safeResponse(res, 200, "Success message");

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Success message" });
  });

  test("should not send response when headers are already sent", () => {
    const res = {
      headersSent: true,
      status: jest.fn(),
      json: jest.fn(),
    };

    safeResponse(res, 500, "This should not be sent");

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

});
