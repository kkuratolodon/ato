// filepath: /Users/suryaputra/Downloads/fin-invoice-ocr-team6/backend/tests/services/purchaseOrderServiceCoverage.test.js
/**
 * This test file is specifically created to target uncovered code lines in purchaseOrderService.js
 * It focuses on direct execution of error handling code paths to ensure coverage of lines 271, 290-294
 */
const PurchaseOrderRepository = require('../../src/repositories/purchaseOrderRepository');
const ItemRepository = require('../../src/repositories/itemRepository');
const CustomerRepository = require('../../src/repositories/customerRepository');
const VendorRepository = require('../../src/repositories/vendorRepository');
const PurchaseOrderResponseFormatter = require('../../src/services/purchaseOrder/purchaseOrderResponseFormatter');
const AzureDocumentAnalyzer = require('../../src/services/analysis/azureDocumentAnalyzer');
const Sentry = require("../../src/instrument");

// Mock all dependencies
jest.mock('../../src/repositories/purchaseOrderRepository');
jest.mock('../../src/repositories/itemRepository');
jest.mock('../../src/repositories/customerRepository');
jest.mock('../../src/repositories/vendorRepository');
jest.mock('../../src/services/purchaseOrder/purchaseOrderResponseFormatter');
jest.mock('../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../src/instrument', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn()
}));

describe('Purchase Order Service Coverage Tests', () => {
  // We need direct access to the original service class without importing the singleton
  const PurchaseOrderService = require('../../src/services/purchaseOrder/purchaseOrderService').constructor;
  let purchaseOrderService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a direct instance of the service for testing
    purchaseOrderService = new PurchaseOrderService();
    purchaseOrderService.purchaseOrderRepository = new PurchaseOrderRepository();
    purchaseOrderService.itemRepository = new ItemRepository();
    purchaseOrderService.customerRepository = new CustomerRepository();
    purchaseOrderService.vendorRepository = new VendorRepository();
    purchaseOrderService.responseFormatter = new PurchaseOrderResponseFormatter();
    purchaseOrderService.documentAnalyzer = new AzureDocumentAnalyzer();
  });
  
  // Direct test for line 271 - throwing a normal Error when purchase order not found
  describe('getPurchaseOrderById', () => {
    test('line 271 - should throw plain Error when purchase order not found', async () => {
      // Arrange - mocking the repository to return null to trigger line 271
      purchaseOrderService.purchaseOrderRepository.findById = jest.fn().mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Act & Assert - expect the function to throw "Purchase order not found"
      await expect(purchaseOrderService.getPurchaseOrderById('non-existent-id'))
        .rejects.toThrow('Purchase order not found');
      
      // Additional verification to ensure the correct path was executed
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('non-existent-id');
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error retrieving purchase order:", 
        expect.objectContaining({
          message: "Purchase order not found"
        })
      );
      
      // Cleanup
      consoleSpy.mockRestore();
    });

    // Additional direct test specifically for line 271, using different approach
    test('line 271 - should throw plain Error when purchase order not found (using direct implementation)', async () => {
      // Create a spy on console.error to prevent logging in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Direct implementation - forcing the execution of line 271
      // Setting up the exact condition that would cause line 271 to be executed
      purchaseOrderService.purchaseOrderRepository = {
        findById: jest.fn().mockResolvedValue(null) // This will cause !purchaseOrder to be true
      };
      
      try {
        // This should hit line 271 directly
        await purchaseOrderService.getPurchaseOrderById('test-id');
        fail('Should have thrown an error');
      } catch (error) {
        // Verify it's the specific error from line 271
        expect(error.message).toBe('Purchase order not found');
      }
      
      // Verify the repository was called with the correct ID
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('test-id');
      
      // Verify the console.error was called (from line 297)
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toBe('Error retrieving purchase order:');
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });
  
  // Direct test for lines 290-294 - error handling in getPurchaseOrderStatus
  describe('getPurchaseOrderStatus - error handling', () => {
    test('lines 290-294 - should log error, capture with Sentry and throw wrapped error', async () => {
      // Arrange - create a unique error that will hit our target code path
      const databaseError = new Error('Database connection failure');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock repository to throw our specific error
      purchaseOrderService.purchaseOrderRepository.findById = jest.fn().mockImplementation(() => {
        throw databaseError;
      });
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderStatus('po-123'))
        .rejects.toThrow('Failed to get purchase order status: Database connection failure');
      
      // Verify that the error was properly logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error getting purchase order status: Database connection failure',
        databaseError
      );
      
      // Verify that Sentry captured the exception
      expect(Sentry.captureException).toHaveBeenCalledWith(databaseError);
      
      // Cleanup
      consoleSpy.mockRestore();
    });
  });
});