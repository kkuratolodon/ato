const purchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');

// Mock repositories
jest.mock('../../../src/repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findById: jest.fn()
  }));
});

// Mock other dependencies
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');

// Mock formatter
jest.mock('../../../src/services/purchaseOrder/purchaseOrderResponseFormatter', () => {
  return jest.fn().mockImplementation(() => ({
    formatPurchaseOrderResponse: jest.fn()
  }));
});

describe('Purchase Order Service - getPurchaseOrderById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console to prevent cluttering test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('should return formatted purchase order when found', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      status: DocumentStatus.ANALYZED,
      po_number: 'PO-123',
      partner_id: 'partner-abc'
    };
    const mockFormattedResponse = { 
      data: { 
        documents: [{ 
          header: { purchase_order_details: { purchase_order_id: 'PO-123' } } 
        }] 
      } 
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    purchaseOrderService.responseFormatter.formatPurchaseOrderResponse.mockReturnValue(mockFormattedResponse);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderById(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(mockPurchaseOrder);
    expect(result).toEqual(mockFormattedResponse);
  });

  test('should throw error when purchase order not found', async () => {
    // Arrange
    const purchaseOrderId = 'non-existent-po';
    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(null);

    // Act & Assert
    await expect(purchaseOrderService.getPurchaseOrderById(purchaseOrderId))
      .rejects.toThrow('Purchase order not found');
    expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).not.toHaveBeenCalled();
  });

  test('should propagate repository errors', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const dbError = new Error('Database connection failed');
    purchaseOrderService.purchaseOrderRepository.findById.mockRejectedValue(dbError);

    // Act & Assert
    await expect(purchaseOrderService.getPurchaseOrderById(purchaseOrderId))
      .rejects.toThrow('Database connection failed');
    expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(console.error).toHaveBeenCalledWith('Error retrieving purchase order:', dbError);
  });
});