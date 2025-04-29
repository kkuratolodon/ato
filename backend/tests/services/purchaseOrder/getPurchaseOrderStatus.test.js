const purchaseOrderService = require('@services/purchaseOrder/purchaseOrderService');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');

// Mock repositories
jest.mock('@repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findById: jest.fn()
  }));
});

// Mock other dependencies
jest.mock('@repositories/customerRepository');
jest.mock('@repositories/vendorRepository');
jest.mock('@repositories/itemRepository');

describe('getPurchaseOrderStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return purchase order status for valid ID', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      status: DocumentStatus.ANALYZED,
      partner_id: 'partner-abc'
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderStatus(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(result).toEqual({
      id: purchaseOrderId,
      status: DocumentStatus.ANALYZED
    });
  });

  test('should return PROCESSING status when purchase order is still processing', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      status: DocumentStatus.PROCESSING,
      partner_id: 'partner-abc'
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderStatus(purchaseOrderId);

    // Assert
    expect(result).toEqual({
      id: purchaseOrderId,
      status: DocumentStatus.PROCESSING
    });
  });

  test('should throw error when purchase order not found', async () => {
    // Arrange
    const purchaseOrderId = 'non-existent-po';
    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(null);

    // Act & Assert
    await expect(purchaseOrderService.getPurchaseOrderStatus(purchaseOrderId))
      .rejects.toThrow('Purchase order not found');
    expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
  });
});