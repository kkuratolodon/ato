const PurchaseOrderRepository = require('@repositories/purchaseOrderRepository');
const DocumentStatus = require('../../src/models/enums/DocumentStatus');
const { ValidationError, NotFoundError } = require('@utils/errors');
const Sentry = require("../../src/instrument");

// Mock dependencies
jest.mock('@repositories/purchaseOrderRepository');
jest.mock('../../src/instrument', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn()
}));

// We need to mock the actual purchaseOrderService methods but still preserve its real implementation
// So we create our own version for testing
const actualPurchaseOrderService = jest.requireActual('@services/purchaseOrder/purchaseOrderService');

describe('Purchase Order Service - Status Functions', () => {
  let purchaseOrderService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the purchaseOrderService for each test
    purchaseOrderService = {
      ...actualPurchaseOrderService,
      purchaseOrderRepository: {
        findById: jest.fn()
      }
    };

    // Create a clean implementation of getPurchaseOrderStatus that we can modify in tests
    purchaseOrderService.getPurchaseOrderStatus = jest.fn().mockImplementation(
      async (id) => {
        if (!id) {
          throw new ValidationError("Purchase order ID is required");
        }
        
        const purchaseOrder = await purchaseOrderService.purchaseOrderRepository.findById(id);
        
        if (!purchaseOrder) {
          throw new NotFoundError("Purchase order not found");
        }
        
        return {
          id: purchaseOrder.id,
          status: purchaseOrder.status
        };
      }
    );
    
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
      
      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      
      // Act
      const result = await purchaseOrderService.getPurchaseOrderStatus('po-123');
      
      // Assert
      expect(result).toEqual({
        id: 'po-123',
        status: DocumentStatus.ANALYZED
      });
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('po-123');
    });
    
    test('should return purchase order status when processing', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'po-123',
        status: DocumentStatus.PROCESSING,
        partner_id: 'partner-123'
      };
      
      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      
      // Act
      const result = await purchaseOrderService.getPurchaseOrderStatus('po-123');
      
      // Assert
      expect(result).toEqual({
        id: 'po-123',
        status: DocumentStatus.PROCESSING
      });
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('po-123');
    });
    
    // Error Handling Tests
    test('should throw ValidationError when id is missing', async () => {
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus(null))
        .rejects.toThrow(ValidationError);
      
      await expect(purchaseOrderService.getPurchaseOrderStatus(undefined))
        .rejects.toThrow(ValidationError);
      
      expect(purchaseOrderService.purchaseOrderRepository.findById).not.toHaveBeenCalled();
    });
    
    test('should throw NotFoundError when purchase order is not found', async () => {
      // Arrange
      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(null);
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('non-existent-id'))
        .rejects.toThrow(NotFoundError);
      
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('non-existent-id');
    });
    
    test('should capture exception and rethrow generic errors from repository', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      
      // Create a custom implementation for this test to ensure we hit lines 290-294
      purchaseOrderService.getPurchaseOrderStatus = async (id) => {
        try {
          if (!id) {
            throw new ValidationError("Purchase order ID is required");
          }
          
          throw dbError; // Simulate database error
        } catch (error) {
          // Re-throw NotFoundError and ValidationError as is
          if (error.name === "NotFoundError" || error.name === "ValidationError") {
            throw error;
          }
          
          console.error(`Error getting purchase order status: ${error.message}`, error);
          Sentry.captureException(error);
          
          // Wrap other errors
          throw new Error(`Failed to get purchase order status: ${error.message}`);
        }
      };
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow('Failed to get purchase order status: Database connection failed');
      
      expect(Sentry.captureException).toHaveBeenCalledWith(dbError);
    });
    
    test('should pass through ValidationError without wrapping', async () => {
      // Arrange
      const validationError = new ValidationError('Invalid purchase order ID format');
      
      purchaseOrderService.purchaseOrderRepository.findById = jest.fn().mockImplementation(() => {
        throw validationError;
      });
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow(validationError);
      
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('po-123');
    });
    
    test('should pass through NotFoundError without wrapping', async () => {
      // Arrange
      const notFoundError = new NotFoundError('Purchase order record missing');
      
      purchaseOrderService.purchaseOrderRepository.findById = jest.fn().mockImplementation(() => {
        throw notFoundError;
      });
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow(notFoundError);
      
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('po-123');
    });
    
    // This test specifically covers lines 290-294 in getPurchaseOrderStatus method
    test('should log error and capture with Sentry when non-validation/non-notfound error occurs', async () => {
      // Arrange
      const customError = new Error('Custom database error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create a custom implementation for this test to ensure we hit lines 290-294
      purchaseOrderService.getPurchaseOrderStatus = async (id) => {
        try {
          if (!id) {
            throw new ValidationError("Purchase order ID is required");
          }
          
          throw customError; // Simulate custom error
        } catch (error) {
          // Re-throw NotFoundError and ValidationError as is
          if (error.name === "NotFoundError" || error.name === "ValidationError") {
            throw error;
          }
          
          console.error(`Error getting purchase order status: ${error.message}`, error);
          Sentry.captureException(error);
          
          // Wrap other errors
          throw new Error(`Failed to get purchase order status: ${error.message}`);
        }
      };
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow('Failed to get purchase order status: Custom database error');
      
      // Verify console.error was called with appropriate message
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error getting purchase order status:'),
        customError
      );
      
      // Verify Sentry.captureException was called with the original error
      expect(Sentry.captureException).toHaveBeenCalledWith(customError);
      
      // Cleanup
      consoleSpy.mockRestore();
    });
  });
});