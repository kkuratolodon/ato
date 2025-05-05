const PurchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');
const PurchaseOrderLogger = require('../../../src/services/purchaseOrder/purchaseOrderLogger');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');
const { NotFoundError } = require('../../../src/utils/errors');
const Sentry = require('../../../src/instrument');

// Mock dependencies
jest.mock('../../../src/services/purchaseOrder/purchaseOrderLogger', () => ({
  logStatusRequest: jest.fn(),
  logStatusNotFound: jest.fn(),
  logStatusError: jest.fn()
}));

jest.mock('../../../src/instrument', () => ({
  captureException: jest.fn()
}));

jest.mock('../../../src/repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findById: jest.fn()
  }));
});

describe('PurchaseOrderService - getPurchaseOrderStatus with Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console to avoid cluttering test output
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });

  test('should log successful status request', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      status: DocumentStatus.ANALYZED
    };

    PurchaseOrderService.purchaseOrderRepository.findById = jest.fn().mockResolvedValue(mockPurchaseOrder);

    // Act
    const result = await PurchaseOrderService.getPurchaseOrderStatus(purchaseOrderId);

    // Assert
    expect(result).toEqual({
      id: purchaseOrderId,
      status: DocumentStatus.ANALYZED
    });
    expect(PurchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(PurchaseOrderLogger.logStatusRequest).toHaveBeenCalledWith(purchaseOrderId, DocumentStatus.ANALYZED);
    expect(PurchaseOrderLogger.logStatusNotFound).not.toHaveBeenCalled();
    expect(PurchaseOrderLogger.logStatusError).not.toHaveBeenCalled();
  });

  test('should log not found status', async () => {
    // Arrange
    const purchaseOrderId = 'non-existent-po';
    PurchaseOrderService.purchaseOrderRepository.findById = jest.fn().mockResolvedValue(null);

    // Act & Assert
    await expect(PurchaseOrderService.getPurchaseOrderStatus(purchaseOrderId))
      .rejects.toThrow('Purchase order not found');
    expect(PurchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(PurchaseOrderLogger.logStatusNotFound).toHaveBeenCalledWith(purchaseOrderId);
    expect(PurchaseOrderLogger.logStatusRequest).not.toHaveBeenCalled();
    expect(PurchaseOrderLogger.logStatusError).not.toHaveBeenCalled();
  });

  test('should log error during status retrieval', async () => {
    // Arrange
    const purchaseOrderId = 'error-po-123';
    const dbError = new Error('Database connection error');
    
    PurchaseOrderService.purchaseOrderRepository.findById = jest.fn().mockRejectedValue(dbError);

    // Act & Assert
    await expect(PurchaseOrderService.getPurchaseOrderStatus(purchaseOrderId))
      .rejects.toThrow('Failed to get purchase order status: Database connection error');
    
    expect(PurchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(PurchaseOrderLogger.logStatusError).toHaveBeenCalledWith(purchaseOrderId, dbError);
    expect(PurchaseOrderLogger.logStatusRequest).not.toHaveBeenCalled();
    expect(PurchaseOrderLogger.logStatusNotFound).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(dbError);
    expect(console.error).toHaveBeenCalled();
  });

  test('should handle and rethrow NotFoundError', async () => {
    // Arrange
    const purchaseOrderId = 'not-found-po';
    const notFoundError = new NotFoundError('Purchase order not found');
    
    PurchaseOrderService.purchaseOrderRepository.findById = jest.fn().mockImplementation(() => {
      throw notFoundError;
    });

    // Act & Assert
    await expect(PurchaseOrderService.getPurchaseOrderStatus(purchaseOrderId))
      .rejects.toThrow(notFoundError);
    
    expect(PurchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    // In this test case, our function doesn't have a chance to call logStatusNotFound 
    // because the error happens at the repository level before the null check
    expect(PurchaseOrderLogger.logStatusError).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test('should log status requests for various status values', async () => {
    // Arrange
    const testCases = [
      { id: 'po-1', status: DocumentStatus.ANALYZED },
      { id: 'po-2', status: DocumentStatus.PROCESSING },
      { id: 'po-3', status: DocumentStatus.FAILED },
      { id: 'po-4', status: null }
    ];

    // Act & Assert
    for (const testCase of testCases) {
      jest.clearAllMocks();
      
      PurchaseOrderService.purchaseOrderRepository.findById = jest.fn().mockResolvedValue({
        id: testCase.id,
        status: testCase.status
      });

      const result = await PurchaseOrderService.getPurchaseOrderStatus(testCase.id);
      
      expect(result).toEqual({
        id: testCase.id,
        status: testCase.status
      });
      
      expect(PurchaseOrderLogger.logStatusRequest).toHaveBeenCalledWith(testCase.id, testCase.status);
      expect(PurchaseOrderLogger.logStatusNotFound).not.toHaveBeenCalled();
      expect(PurchaseOrderLogger.logStatusError).not.toHaveBeenCalled();
    }
  });
});