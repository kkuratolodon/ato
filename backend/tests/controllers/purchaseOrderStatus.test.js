const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { PurchaseOrderController } = require("@controllers/purchaseOrderController");
const DocumentStatus = require("../../src/models/enums/DocumentStatus");
const { NotFoundError } = require('@utils/errors');

describe("Purchase Order Controller - Status Endpoint", () => {
  let req, res, controller;
  
  const mockPurchaseOrderService = {
    uploadPurchaseOrder: jest.fn(),
    getPurchaseOrderStatus: jest.fn(),
    getPartnerId: jest.fn()
  };

  beforeEach(() => {
    req = mockRequest({
      params: {
        id: "po-123"
      },
      user: {
        uuid: "partner-123"
      }
    });
    res = mockResponse();
    controller = new PurchaseOrderController(mockPurchaseOrderService);
    jest.clearAllMocks();
  });

  test("should return purchase order status for authenticated user", async () => {
    // Arrange
    const expectedResult = {
      id: "po-123",
      status: DocumentStatus.ANALYZED
    };
    
    mockPurchaseOrderService.getPartnerId.mockResolvedValue("partner-123");
    mockPurchaseOrderService.getPurchaseOrderStatus.mockResolvedValue(expectedResult);

    // Act
    await controller.getPurchaseOrderStatus(req, res);

    // Assert
    expect(mockPurchaseOrderService.getPartnerId).toHaveBeenCalledWith("po-123");
    expect(mockPurchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith("po-123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expectedResult);
  });

  test("should return processing status when purchase order is still being processed", async () => {
    // Arrange
    const expectedResult = {
      id: "po-123",
      status: DocumentStatus.PROCESSING
    };
    
    mockPurchaseOrderService.getPartnerId.mockResolvedValue("partner-123");
    mockPurchaseOrderService.getPurchaseOrderStatus.mockResolvedValue(expectedResult);

    // Act
    await controller.getPurchaseOrderStatus(req, res);

    // Assert
    expect(mockPurchaseOrderService.getPartnerId).toHaveBeenCalledWith("po-123");
    expect(mockPurchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith("po-123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expectedResult);
  });

  test("should check user authorization before returning status", async () => {
    // Arrange
    mockPurchaseOrderService.getPartnerId.mockResolvedValue("partner-123");
    mockPurchaseOrderService.getPurchaseOrderStatus.mockResolvedValue({
      id: "po-123",
      status: DocumentStatus.ANALYZED
    });

    const validateSpy = jest.spyOn(controller, 'validateGetRequest');
    
    // Act
    await controller.getPurchaseOrderStatus(req, res);
    
    // Assert
    expect(validateSpy).toHaveBeenCalledWith(req, "po-123");
    expect(mockPurchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith("po-123");
  });

  // Error handling test cases
  test("should return 401 when user is not authenticated", async () => {
    // Arrange
    req = mockRequest({
      params: { id: "po-123" },
      user: null
    });
    
    // Act
    await controller.getPurchaseOrderStatus(req, res);
    
    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  test("should return 400 when purchase order ID is missing", async () => {
    // Arrange
    req = mockRequest({
      params: { id: null },
      user: { uuid: "partner-123" }
    });
    
    // Act
    await controller.getPurchaseOrderStatus(req, res);
    
    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Purchase order ID is required" });
  });

  test("should return 403 when purchase order doesn't belong to authenticated user", async () => {
    // Arrange
    mockPurchaseOrderService.getPartnerId.mockResolvedValue("different-partner-123");
    
    // Act
    await controller.getPurchaseOrderStatus(req, res);
    
    // Assert
    expect(mockPurchaseOrderService.getPartnerId).toHaveBeenCalledWith("po-123");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden: You do not have access to this purchase order" });
  });

  test("should return 404 when purchase order not found", async () => {
    // Arrange
    mockPurchaseOrderService.getPartnerId.mockResolvedValue("partner-123");
    mockPurchaseOrderService.getPurchaseOrderStatus.mockRejectedValue(new NotFoundError("Purchase order not found"));
    
    // Act
    await controller.getPurchaseOrderStatus(req, res);
    
    // Assert
    expect(mockPurchaseOrderService.getPartnerId).toHaveBeenCalledWith("po-123");
    expect(mockPurchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith("po-123");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Purchase order not found" });
  });

  test("should return 500 when an unexpected error occurs", async () => {
    // Arrange
    mockPurchaseOrderService.getPartnerId.mockResolvedValue("partner-123");
    mockPurchaseOrderService.getPurchaseOrderStatus.mockRejectedValue(new Error("Database connection failed"));
    
    // Act
    await controller.getPurchaseOrderStatus(req, res);
    
    // Assert
    expect(mockPurchaseOrderService.getPartnerId).toHaveBeenCalledWith("po-123");
    expect(mockPurchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith("po-123");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});