const DocumentStatus = require('../../../src/models/enums/DocumentStatus');
const purchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');

// Mock the repository instead of the model
jest.mock('../../../src/repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    update: jest.fn()
  }));
});

// Mock other repositories that PurchaseOrderService might need
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');

// Mock other dependencies
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/purchaseOrder/purchaseOrderValidator');
jest.mock('../../../src/services/purchaseOrder/purchaseOrderResponseFormatter');
jest.mock('../../../src/services/purchaseOrderMapperService/purchaseOrderMapperService');

// Mock console methods to verify they are called
global.console = {
  log: jest.fn(),
  error: jest.fn()
};

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

describe('updatePurchaseOrderRecord method', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('should return early when purchaseOrderData is undefined', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const purchaseOrderData = undefined;
    
    // Act
    await purchaseOrderService.updatePurchaseOrderRecord(purchaseOrderId, purchaseOrderData);
    
    // Assert
    expect(console.error).toHaveBeenCalledWith('Purchase order data is undefined!');
    expect(purchaseOrderService.purchaseOrderRepository.update).not.toHaveBeenCalled();
  });
  
  test('should return early when purchaseOrderData is null', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const purchaseOrderData = null;
    
    // Act
    await purchaseOrderService.updatePurchaseOrderRecord(purchaseOrderId, purchaseOrderData);
    
    // Assert
    expect(console.error).toHaveBeenCalledWith('Purchase order data is undefined!');
  });

  test('should update purchase order with valid data', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const purchaseOrderData = {
      purchase_order_number: 'PO-001',
      issue_date: '2023-05-01',
      delivery_date: '2023-05-31'
    };
    
    // Act
    await purchaseOrderService.updatePurchaseOrderRecord(purchaseOrderId, purchaseOrderData);
    
    // Assert
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      purchaseOrderId, 
      purchaseOrderData
    );
    expect(console.log).toHaveBeenCalledWith(`Purchase order data updated for ${purchaseOrderId}`);
  });

  test('should handle errors during update', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const purchaseOrderData = {
      purchase_order_number: 'PO-001',
      issue_date: '2023-05-01'
    };
    
    const error = new Error('Database connection failed');
    purchaseOrderService.purchaseOrderRepository.update.mockRejectedValue(error);
    
    // Act & Assert
    await expect(
      purchaseOrderService.updatePurchaseOrderRecord(purchaseOrderId, purchaseOrderData)
    ).rejects.toThrow('Failed to update purchase order: Database connection failed');
    
    expect(console.error).toHaveBeenCalledWith('Error updating purchase order:', error);
  });
});