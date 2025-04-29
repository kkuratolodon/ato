const purchaseOrderService = require('@services/purchaseOrder/purchaseOrderService');

// Mock repositories directly
jest.mock('@repositories/itemRepository', () => {
  return jest.fn().mockImplementation(() => ({
    createDocumentItem: jest.fn(),
    findItemsByDocumentId: jest.fn()
  }));
});

jest.mock('@repositories/purchaseOrderRepository');
jest.mock('@repositories/customerRepository');
jest.mock('@repositories/vendorRepository');

// Mock other dependencies
jest.mock('@azure/ai-form-recognizer');
jest.mock('@services/s3Service', () => ({ uploadFile: jest.fn() }));
jest.mock('@services/analysis/azureDocumentAnalyzer');
jest.mock('@services/purchaseOrder/purchaseOrderValidator');
jest.mock('@services/purchaseOrder/purchaseOrderResponseFormatter');
jest.mock('@services/purchaseOrderMapperService/purchaseOrderMapperService');

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid-123')
}));

// Mock Sentry
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

describe('savePurchaseOrderItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reassign mocked ItemRepository instance to service (ensure mock applies)
    const ItemRepository = require('@repositories/itemRepository');
    purchaseOrderService.itemRepository = new ItemRepository();
    // Ensure createDocumentItem resolves by default
    purchaseOrderService.itemRepository.createDocumentItem.mockResolvedValue();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });
  
  afterEach(() => {
    // Remove restoreAllMocks to preserve mock implementations
    jest.clearAllMocks();
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('should successfully save purchase order items', async () => {
    // Arrange
    const purchaseOrderId = '1';
    const itemsData = [
      { description: 'Item 1', quantity: 2, unit: 'pcs', unitPrice: 10.5, amount: 21 },
      { description: 'Item 2', quantity: 1, unit: 'kg', unitPrice: 15.75, amount: 15.75 }
    ];

    // Act
    await purchaseOrderService.savePurchaseOrderItems(purchaseOrderId, itemsData);

    // Assert
    // Should call createDocumentItem twice with correct item data
    expect(purchaseOrderService.itemRepository.createDocumentItem).toHaveBeenCalledTimes(2);
    expect(purchaseOrderService.itemRepository.createDocumentItem).toHaveBeenNthCalledWith(
      1,
      'PurchaseOrder',
      purchaseOrderId,
      { description:'Item 1', quantity: 2, unit: 'pcs', unit_price: 10.5, amount: 21 }
    );
    expect(purchaseOrderService.itemRepository.createDocumentItem).toHaveBeenNthCalledWith(
      2,
      'PurchaseOrder',
      purchaseOrderId,
      { description:'Item 2', quantity: 1, unit: 'kg', unit_price: 15.75, amount: 15.75 }
    );
  });

  test('should handle empty itemsData array', async () => {
    // Arrange
    const purchaseOrderId = '1';
    const itemsData = [];

    // Act
    await purchaseOrderService.savePurchaseOrderItems(purchaseOrderId, itemsData);

    // Assert
    expect(purchaseOrderService.itemRepository.createDocumentItem).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("No items to save");
  });

  test('should handle undefined itemsData', async () => {
    // Arrange
    const purchaseOrderId = '1';
    const itemsData = undefined;

    // Act
    await purchaseOrderService.savePurchaseOrderItems(purchaseOrderId, itemsData);

    // Assert
    expect(purchaseOrderService.itemRepository.createDocumentItem).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("No items to save");
  });

  test('should handle database error when saving item', async () => {
    // Arrange
    const purchaseOrderId = '1';
    const itemsData = [
      { description: 'Error Item', quantity: 1, unit: 'ea', unitPrice: 10, amount: 10 }
    ];

    // Mock a database error on createDocumentItem
    purchaseOrderService.itemRepository.createDocumentItem.mockRejectedValue(new Error('Database error'));

    // Act & Assert
    await expect(purchaseOrderService.savePurchaseOrderItems(purchaseOrderId, itemsData))
      .rejects.toThrow('Failed to save purchase order items: Database error');

    expect(purchaseOrderService.itemRepository.createDocumentItem).toHaveBeenCalledWith(
      'PurchaseOrder',
      purchaseOrderId,
      {description:'Error Item', quantity: 1, unit: 'ea', unit_price: 10, amount: 10 }
    );
    expect(console.error).toHaveBeenCalled();
  });

  test('should apply fallback values when item data fields are missing or falsy', async () => {
    // Arrange
    const purchaseOrderId = '1';
    const itemsWithMissingValues = [
      {
        description: 'Item with missing values'
        // quantity, unit, unit_price, and amount are missing
      },
      {
        description: null,
        quantity: null,
        unit: null,
        unitPrice: null,
        amount: null
      },
      {
        description: 'Item with zero values',
        quantity: 0,
        unitPrice: 0,
        amount: 0
      }
    ];

    // Act
    await purchaseOrderService.savePurchaseOrderItems(purchaseOrderId, itemsWithMissingValues);

    // Assert
    expect(purchaseOrderService.itemRepository.createDocumentItem).toHaveBeenCalledTimes(3);

    // Check first call (missing values)
    expect(purchaseOrderService.itemRepository.createDocumentItem.mock.calls[0][2]).toEqual({
      description: 'Item with missing values', // Added description
      quantity: 0,            // Default value applied
      unit: null,             // Default value applied
      unit_price: 0,          // Default value applied
      amount: 0               // Default value applied
    });

    // Check second call (null values)
    expect(purchaseOrderService.itemRepository.createDocumentItem.mock.calls[1][2]).toEqual({
      description: null, // Added description
      quantity: 0,            // Default value applied
      unit: null,             // Null preserved
      unit_price: 0,          // Default value applied
      amount: 0               // Default value applied
    });

    // Check third call (zero values)
    expect(purchaseOrderService.itemRepository.createDocumentItem.mock.calls[2][2]).toEqual({
      description: 'Item with zero values', // Added description
      quantity: 0,            // Zero preserved
      unit: null,             // Default value applied
      unit_price: 0,          // Zero preserved
      amount: 0               // Zero preserved
    });
  });

  test('should correctly handle item data with all fields present', async () => {
    // Arrange
    const purchaseOrderId = '1';
    const completeItemData = {
      description: 'Complete Item',
      quantity: 5,
      unit: 'kg',
      unitPrice: 10.99,
      amount: 54.95
    };

    // Act
    await purchaseOrderService.savePurchaseOrderItems(purchaseOrderId, [completeItemData]);

    // Assert
    expect(purchaseOrderService.itemRepository.createDocumentItem).toHaveBeenCalledWith(
      'PurchaseOrder',
      purchaseOrderId,
      { description:'Complete Item', quantity: 5, unit: 'kg', unit_price: 10.99, amount: 54.95 }
    );
    expect(console.log).toHaveBeenCalledWith(`Saved 1 items for purchase order ${purchaseOrderId}`);
  });
});