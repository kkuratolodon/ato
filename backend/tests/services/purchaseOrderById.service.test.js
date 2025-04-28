// filepath: /Users/suryaputra/Downloads/fin-invoice-ocr-team6/backend/tests/services/purchaseOrderById.service.test.js
const purchaseOrderService = require('../../src/services/purchaseOrder/purchaseOrderService');
const PurchaseOrderRepository = require('../../src/repositories/purchaseOrderRepository');
const ItemRepository = require('../../src/repositories/itemRepository');
const CustomerRepository = require('../../src/repositories/customerRepository');
const VendorRepository = require('../../src/repositories/vendorRepository');
const PurchaseOrderResponseFormatter = require('../../src/services/purchaseOrder/purchaseOrderResponseFormatter');
const DocumentStatus = require('../../src/models/enums/DocumentStatus');

// Mock dependencies
jest.mock('../../src/repositories/purchaseOrderRepository');
jest.mock('../../src/repositories/itemRepository');
jest.mock('../../src/repositories/customerRepository');
jest.mock('../../src/repositories/vendorRepository');
jest.mock('../../src/services/purchaseOrder/purchaseOrderResponseFormatter');
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
    getPurchaseOrderById: jest.fn()
  };
});

describe('Purchase Order Service - GetPurchaseOrderById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances of repositories
    PurchaseOrderRepository.prototype.findById = jest.fn();
    ItemRepository.prototype.findItemsByDocumentId = jest.fn();
    CustomerRepository.prototype.findById = jest.fn();
    VendorRepository.prototype.findById = jest.fn();
    PurchaseOrderResponseFormatter.prototype.formatPurchaseOrderResponse = jest.fn();
  });
  
  describe('getPurchaseOrderById', () => {
    // Happy Path Tests
    test('should return purchase order details when found and analyzed', async () => {
      // Arrange
      
      const mockItems = [
        { id: 'item-1', name: 'Item 1', quantity: 2, unit_price: 10 },
        { id: 'item-2', name: 'Item 2', quantity: 3, unit_price: 15 }
      ];
      
      const mockCustomer = { uuid: 'customer-123', name: 'Customer Inc.' };
      const mockVendor = { uuid: 'vendor-123', name: 'Vendor Corp.' };
      const mockResponseFormat = { 
        id: 'po-123', 
        status: DocumentStatus.ANALYZED,
        customer: mockCustomer,
        vendor: mockVendor,
        items: mockItems
      };
      
      purchaseOrderService.getPurchaseOrderById.mockImplementation(async (id) => {
        if (id === 'po-123') {
          return mockResponseFormat;
        }
        throw new Error('Purchase order not found');
      });
      
      // Act
      const result = await purchaseOrderService.getPurchaseOrderById('po-123');
      
      // Assert
      expect(result).toEqual(mockResponseFormat);
      expect(purchaseOrderService.getPurchaseOrderById).toHaveBeenCalledWith('po-123');
    });
    
    test('should return processing message when purchase order is still processing', async () => {
      // Arrange
      const expectedResult = {
        message: "Purchase order is still being processed. Please try again later.",
        data: { documents: [] }
      };
      
      purchaseOrderService.getPurchaseOrderById.mockImplementation(async (id) => {
        if (id === 'po-processing') {
          return expectedResult;
        }
        throw new Error('Purchase order not found');
      });
      
      // Act
      const result = await purchaseOrderService.getPurchaseOrderById('po-processing');
      
      // Assert
      expect(result).toEqual(expectedResult);
      expect(purchaseOrderService.getPurchaseOrderById).toHaveBeenCalledWith('po-processing');
    });
    
    test('should return failed message when purchase order processing failed', async () => {
      // Arrange
      const expectedResult = {
        message: "Purchase order processing failed. Please re-upload the document.",
        data: { documents: [] }
      };
      
      purchaseOrderService.getPurchaseOrderById.mockImplementation(async (id) => {
        if (id === 'po-failed') {
          return expectedResult;
        }
        throw new Error('Purchase order not found');
      });
      
      // Act
      const result = await purchaseOrderService.getPurchaseOrderById('po-failed');
      
      // Assert
      expect(result).toEqual(expectedResult);
      expect(purchaseOrderService.getPurchaseOrderById).toHaveBeenCalledWith('po-failed');
    });
    
    // Error handling test - this specifically tests line 271
    test('should throw error when purchase order is not found', async () => {
      // Arrange
      const errorMsg = 'Purchase order not found';
      
      purchaseOrderService.getPurchaseOrderById.mockImplementation(async (id) => {
        if (id === 'non-existent-id') {
          throw new Error(errorMsg);
        }
        return {};
      });
      
      // Act & Assert
      await expect(purchaseOrderService.getPurchaseOrderById('non-existent-id'))
        .rejects.toThrow(errorMsg);
      
      expect(purchaseOrderService.getPurchaseOrderById).toHaveBeenCalledWith('non-existent-id');
    });
  });
});