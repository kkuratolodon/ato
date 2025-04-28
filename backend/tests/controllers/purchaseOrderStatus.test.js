const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { PurchaseOrderController } = require("../../src/controllers/purchaseOrderController");
const DocumentStatus = require("../../src/models/enums/DocumentStatus");

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
});