const purchaseOrderService = require('../../src/services/purchaseOrder/purchaseOrderService');
const PurchaseOrderRepository = require('../../src/repositories/purchaseOrderRepository');
const DocumentStatus = require('../../src/models/enums/DocumentStatus');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');
const Sentry = require("../../src/instrument");

// Mock dependencies
jest.mock('../../src/repositories/purchaseOrderRepository');
jest.mock('../../src/instrument', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn()
}));

describe('Purchase Order Service - Status Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the repository's findById mock implementation
    PurchaseOrderRepository.prototype.findById = jest.fn();
  });
  
  describe('getPurchaseOrderStatus', () => {
    // Happy Path Tests
    test('should return purchase order status when found', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'po-123',
        status: DocumentStatus.ANALYZED,
        partner_id: 'partner-123'
      };
      PurchaseOrderRepository.prototype.findById.mockResolvedValue(mockPurchaseOrder);
      
      // Act
      const result = await purchaseOrderService.getPurchaseOrderStatus('po-123');
      
      // Assert
      expect(PurchaseOrderRepository.prototype.findById).toHaveBeenCalledWith('po-123');
      expect(result).toEqual({
        id: 'po-123',
        status: DocumentStatus.ANALYZED
      });
    });
    
    test('should return purchase order status when processing', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'po-123',
        status: DocumentStatus.PROCESSING,
        partner_id: 'partner-123'
      };
      PurchaseOrderRepository.prototype.findById.mockResolvedValue(mockPurchaseOrder);
      
      // Act
      const result = await purchaseOrderService.getPurchaseOrderStatus('po-123');
      
      // Assert
      expect(PurchaseOrderRepository.prototype.findById).toHaveBeenCalledWith('po-123');
      expect(result).toEqual({
        id: 'po-123',
        status: DocumentStatus.PROCESSING
      });
    });
    
    // Error Handling Tests
    test('should throw ValidationError when id is missing', async () => {
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus(null))
        .rejects.toThrow(ValidationError);
      
      await expect(purchaseOrderService.getPurchaseOrderStatus(undefined))
        .rejects.toThrow(ValidationError);
      
      expect(PurchaseOrderRepository.prototype.findById).not.toHaveBeenCalled();
    });
    
    test('should throw NotFoundError when purchase order is not found', async () => {
      // Arrange
      PurchaseOrderRepository.prototype.findById.mockResolvedValue(null);
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('non-existent-id'))
        .rejects.toThrow(NotFoundError);
      
      expect(PurchaseOrderRepository.prototype.findById).toHaveBeenCalledWith('non-existent-id');
    });
    
    test('should capture exception and rethrow generic errors from repository', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      PurchaseOrderRepository.prototype.findById.mockRejectedValue(dbError);
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow('Failed to get purchase order status: Database connection failed');
      
      expect(PurchaseOrderRepository.prototype.findById).toHaveBeenCalledWith('po-123');
      expect(Sentry.captureException).toHaveBeenCalledWith(dbError);
    });
    
    test('should pass through ValidationError without wrapping', async () => {
      // Arrange
      const validationError = new ValidationError('Invalid purchase order ID format');
      PurchaseOrderRepository.prototype.findById.mockRejectedValue(validationError);
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow(validationError);
      
      expect(PurchaseOrderRepository.prototype.findById).toHaveBeenCalledWith('po-123');
    });
    
    test('should pass through NotFoundError without wrapping', async () => {
      // Arrange
      const notFoundError = new NotFoundError('Purchase order record missing');
      PurchaseOrderRepository.prototype.findById.mockRejectedValue(notFoundError);
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow(notFoundError);
      
      expect(PurchaseOrderRepository.prototype.findById).toHaveBeenCalledWith('po-123');
    });
  });
});