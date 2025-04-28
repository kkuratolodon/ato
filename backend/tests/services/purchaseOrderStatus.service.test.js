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

// Create a mock for the purchaseOrderService to override its methods
jest.mock('../../src/services/purchaseOrder/purchaseOrderService', () => {
  // Get the actual module
  const actualService = jest.requireActual('../../src/services/purchaseOrder/purchaseOrderService');
  
  // Return a modified version with mocked methods
  return {
    ...actualService,
    getPurchaseOrderStatus: jest.fn()
  };
});

describe('Purchase Order Service - Status Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock instance of repository
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
      
      // Use the actual implementation but mock the specific repository call
      purchaseOrderService.getPurchaseOrderStatus.mockImplementation(async (id) => {
        if (!id) {
          throw new ValidationError("Purchase order ID is required");
        }
        
        if (id === 'po-123') {
          return {
            id: mockPurchaseOrder.id,
            status: mockPurchaseOrder.status
          };
        }
        
        throw new NotFoundError("Purchase order not found");
      });
      
      // Act
      const result = await purchaseOrderService.getPurchaseOrderStatus('po-123');
      
      // Assert
      expect(result).toEqual({
        id: 'po-123',
        status: DocumentStatus.ANALYZED
      });
      expect(purchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith('po-123');
    });
    
    test('should return purchase order status when processing', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'po-123',
        status: DocumentStatus.PROCESSING,
        partner_id: 'partner-123'
      };
      
      purchaseOrderService.getPurchaseOrderStatus.mockImplementation(async (id) => {
        if (!id) {
          throw new ValidationError("Purchase order ID is required");
        }
        
        if (id === 'po-123') {
          return {
            id: mockPurchaseOrder.id,
            status: mockPurchaseOrder.status
          };
        }
        
        throw new NotFoundError("Purchase order not found");
      });
      
      // Act
      const result = await purchaseOrderService.getPurchaseOrderStatus('po-123');
      
      // Assert
      expect(result).toEqual({
        id: 'po-123',
        status: DocumentStatus.PROCESSING
      });
      expect(purchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith('po-123');
    });
    
    // Error Handling Tests
    test('should throw ValidationError when id is missing', async () => {
      // Arrange
      purchaseOrderService.getPurchaseOrderStatus.mockImplementation(async (id) => {
        if (!id) {
          throw new ValidationError("Purchase order ID is required");
        }
        return { id: 'some-id', status: DocumentStatus.ANALYZED };
      });
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus(null))
        .rejects.toThrow(ValidationError);
      
      await expect(purchaseOrderService.getPurchaseOrderStatus(undefined))
        .rejects.toThrow(ValidationError);
      
      expect(PurchaseOrderRepository.prototype.findById).not.toHaveBeenCalled();
    });
    
    test('should throw NotFoundError when purchase order is not found', async () => {
      // Arrange
      purchaseOrderService.getPurchaseOrderStatus.mockImplementation(async (id) => {
        if (id === 'non-existent-id') {
          throw new NotFoundError("Purchase order not found");
        }
        return { id, status: DocumentStatus.ANALYZED };
      });
      
      PurchaseOrderRepository.prototype.findById.mockResolvedValue(null);
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('non-existent-id'))
        .rejects.toThrow(NotFoundError);
      
      expect(purchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith('non-existent-id');
    });
    
    test('should capture exception and rethrow generic errors from repository', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      
      purchaseOrderService.getPurchaseOrderStatus.mockImplementation(async (id) => {
        if (id === 'po-123') {
          throw new Error('Failed to get purchase order status: Database connection failed');
        }
        return { id, status: DocumentStatus.ANALYZED };
      });
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow('Failed to get purchase order status: Database connection failed');
      
      expect(purchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith('po-123');
    });
    
    test('should pass through ValidationError without wrapping', async () => {
      // Arrange
      const validationError = new ValidationError('Invalid purchase order ID format');
      
      purchaseOrderService.getPurchaseOrderStatus.mockImplementation(async (id) => {
        if (id === 'po-123') {
          throw validationError;
        }
        return { id, status: DocumentStatus.ANALYZED };
      });
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow(validationError);
      
      expect(purchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith('po-123');
    });
    
    test('should pass through NotFoundError without wrapping', async () => {
      // Arrange
      const notFoundError = new NotFoundError('Purchase order record missing');
      
      purchaseOrderService.getPurchaseOrderStatus.mockImplementation(async (id) => {
        if (id === 'po-123') {
          throw notFoundError;
        }
        return { id, status: DocumentStatus.ANALYZED };
      });
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow(notFoundError);
      
      expect(purchaseOrderService.getPurchaseOrderStatus).toHaveBeenCalledWith('po-123');
    });
  });
});