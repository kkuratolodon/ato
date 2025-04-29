const PurchaseOrderService = require('@services/purchaseOrder/purchaseOrderService');

// Mock the repository methods instead of models
jest.mock('@repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findById: jest.fn()
  }));
});

// Other mocks needed for PurchaseOrderService to initialize properly
jest.mock('@repositories/customerRepository');
jest.mock('@repositories/vendorRepository');
jest.mock('@repositories/itemRepository');
jest.mock('@services/analysis/azureDocumentAnalyzer');
jest.mock('@services/purchaseOrder/purchaseOrderValidator');
jest.mock('@services/purchaseOrder/purchaseOrderResponseFormatter');
jest.mock('@services/purchaseOrderMapperService/purchaseOrderMapperService');

// Sentry mock
jest.mock('../../../src/instrument', () => ({
  init: jest.fn(),
  startSpan: jest.fn((_, callback) => callback({
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn()
  })),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

describe("getPartnerId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Should return partner_id when given a valid purchase order ID", async () => {
    // Mock the repository response for a successful lookup
    const mockPurchaseOrder = {
      id: "purchase-order-123",
      partner_id: "partner-123"
    };
    
    // Set up the mock to return our test purchase order
    PurchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);

    // Call the method being tested
    const result = await PurchaseOrderService.getPartnerId("purchase-order-123");

    // Assertions
    expect(result).toBe("partner-123");
    expect(PurchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith("purchase-order-123");
  });

  test("Should throw an error when purchase order is not found", async () => {
    // Mock the repository to return null (purchase order not found)
    PurchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(null);

    // Test that calling the method throws the expected error
    await expect(PurchaseOrderService.getPartnerId("nonexistent-purchase-order"))
      .rejects.toThrow("Purchase order not found");
      
    expect(PurchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith("nonexistent-purchase-order");
  });

  test("Should throw an error when database fails", async () => {
    // Mock the repository to throw an error
    const dbError = new Error("Database error");
    PurchaseOrderService.purchaseOrderRepository.findById.mockRejectedValue(dbError);

    // Test that the error is properly propagated
    await expect(PurchaseOrderService.getPartnerId("purchase-order-123"))
      .rejects.toThrow("Database error");
      
    expect(PurchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith("purchase-order-123");
  });
});