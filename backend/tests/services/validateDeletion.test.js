// Mock the repository before requiring the module that uses it
jest.mock('../../src/repositories/invoiceRepository');
jest.mock('../../src/repositories/purchaseOrderRepository');

// Now import the modules
const validateDeletion = require('../../src/services/validateDeletion');
const InvoiceRepository = require('../../src/repositories/invoiceRepository');
const PurchaseOrderRepository = require('../../src/repositories/purchaseOrderRepository');
const DocumentStatus = require('../../src/models/enums/DocumentStatus');

describe('ValidateDeletion Service', () => {
  let mockFindById;
  let mockPOFindById;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup the mock implementation for findById
    mockFindById = jest.fn();
    mockPOFindById = jest.fn();
    
    // Create a proper mock for the repositories
    InvoiceRepository.mockImplementation(() => {
      return {
        findById: mockFindById
      };
    });
    
    PurchaseOrderRepository.mockImplementation(() => {
      return {
        findById: mockPOFindById
      };
    });
    
    // Replace the repository instances in validateDeletion with our mocks
    validateDeletion.invoiceRepository = new InvoiceRepository();
    validateDeletion.purchaseOrderRepository = new PurchaseOrderRepository();
  });

  // Invoice validation tests
  describe('Invoice validation', () => {
    // Positive test cases
    describe('Positive cases', () => {
      test('should successfully validate an invoice for deletion', async () => {
        // Arrange
        const mockInvoice = {
          id: 'uuid-123',
          partner_id: 'partner123',
          status: DocumentStatus.ANALYZED, 
        };
        
        mockFindById.mockResolvedValue(mockInvoice);
        
        // Act
        const result = await validateDeletion.validateInvoiceDeletion('partner123', 'uuid-123');
        
        // Assert
        expect(result).toEqual(mockInvoice);
        expect(mockFindById).toHaveBeenCalledWith('uuid-123');
      });
    });

    // Negative test cases
    describe('Negative cases', () => {
      test('should throw error if invoice ID is not provided', async () => {
        // Act & Assert
        await expect(validateDeletion.validateInvoiceDeletion('partner123', null))
          .rejects.toThrow('Invalid invoice ID');
        
        expect(mockFindById).not.toHaveBeenCalled();
      });

      test('should throw error if invoice is not found', async () => {
        // Arrange
        mockFindById.mockResolvedValue(null);
        
        // Act & Assert
        await expect(validateDeletion.validateInvoiceDeletion('partner123', 'uuid-123'))
          .rejects.toThrow('Invoice not found');
        
        expect(mockFindById).toHaveBeenCalledWith('uuid-123');
      });

      test('should throw error if partner does not own the invoice', async () => {
        // Arrange
        const mockInvoice = {
          id: 'uuid-123',
          partner_id: 'different_partner',
          status: DocumentStatus.ANALYZED
        };
        
        mockFindById.mockResolvedValue(mockInvoice);
        
        // Act & Assert
        await expect(validateDeletion.validateInvoiceDeletion('partner123', 'uuid-123'))
          .rejects.toThrow('Unauthorized: You do not own this invoice');
        
        expect(mockFindById).toHaveBeenCalledWith('uuid-123');
      });

      test('should throw error if invoice status is not "Analyzed"', async () => {
        // Arrange
        const mockInvoice = {
          id: 'uuid-123',
          partner_id: 'partner123',
          status: DocumentStatus.PROCESSING
        };
        
        mockFindById.mockResolvedValue(mockInvoice);
        
        // Act & Assert
        await expect(validateDeletion.validateInvoiceDeletion('partner123', 'uuid-123'))
          .rejects.toThrow('Invoice cannot be deleted unless it is Analyzed');
        
        expect(mockFindById).toHaveBeenCalledWith('uuid-123');
      });
    });

    // Edge cases
    describe('Edge cases', () => {
      test('should throw error for empty string invoice ID', async () => {
        // Act & Assert
        await expect(validateDeletion.validateInvoiceDeletion('partner123', ''))
          .rejects.toThrow('Invalid invoice ID');
        
        expect(mockFindById).not.toHaveBeenCalled();
      });

      test('should handle valid string IDs', async () => {
        // Arrange - string ID that's valid in the system
        const mockInvoice = {
          id: 'valid-uuid',
          partner_id: 'partner123',
          status: DocumentStatus.ANALYZED
        };
        
        mockFindById.mockResolvedValue(mockInvoice);
        
        // Act
        const result = await validateDeletion.validateInvoiceDeletion('partner123', 'valid-uuid');
        
        // Assert
        expect(result).toEqual(mockInvoice);
        expect(mockFindById).toHaveBeenCalledWith('valid-uuid');
      });

      test('should throw error for undefined invoice ID', async () => {
        // Act & Assert
        await expect(validateDeletion.validateInvoiceDeletion('partner123', undefined))
          .rejects.toThrow('Invalid invoice ID');
        
        expect(mockFindById).not.toHaveBeenCalled();
      });
    });
  });

  // Purchase Order validation tests
  describe('Purchase Order validation', () => {
    // Positive test cases
    describe('Positive cases', () => {
      test('should successfully validate a purchase order for deletion', async () => {
        // Arrange
        const mockPurchaseOrder = {
          id: 'po-123',
          partner_id: 'partner123',
          status: DocumentStatus.ANALYZED, 
        };
        
        mockPOFindById.mockResolvedValue(mockPurchaseOrder);
        
        // Act
        const result = await validateDeletion.validatePurchaseOrderDeletion('partner123', 'po-123');
        
        // Assert
        expect(result).toEqual(mockPurchaseOrder);
        expect(mockPOFindById).toHaveBeenCalledWith('po-123');
      });
    });

    // Negative test cases
    describe('Negative cases', () => {
      test('should throw error if purchase order ID is not provided', async () => {
        // Act & Assert
        await expect(validateDeletion.validatePurchaseOrderDeletion('partner123', null))
          .rejects.toThrow('Invalid purchase order ID');
        
        expect(mockPOFindById).not.toHaveBeenCalled();
      });

      test('should throw error if purchase order is not found', async () => {
        // Arrange
        mockPOFindById.mockResolvedValue(null);
        
        // Act & Assert
        await expect(validateDeletion.validatePurchaseOrderDeletion('partner123', 'po-123'))
          .rejects.toThrow('Purchase order not found');
        
        expect(mockPOFindById).toHaveBeenCalledWith('po-123');
      });

      test('should throw error if partner does not own the purchase order', async () => {
        // Arrange
        const mockPurchaseOrder = {
          id: 'po-123',
          partner_id: 'different_partner',
          status: DocumentStatus.ANALYZED
        };
        
        mockPOFindById.mockResolvedValue(mockPurchaseOrder);
        
        // Act & Assert
        await expect(validateDeletion.validatePurchaseOrderDeletion('partner123', 'po-123'))
          .rejects.toThrow('Unauthorized: You do not own this purchase order');
        
        expect(mockPOFindById).toHaveBeenCalledWith('po-123');
      });

      test('should throw error if purchase order status is not "Analyzed"', async () => {
        // Arrange
        const mockPurchaseOrder = {
          id: 'po-123',
          partner_id: 'partner123',
          status: DocumentStatus.PROCESSING
        };
        
        mockPOFindById.mockResolvedValue(mockPurchaseOrder);
        
        // Act & Assert
        await expect(validateDeletion.validatePurchaseOrderDeletion('partner123', 'po-123'))
          .rejects.toThrow('Purchase order cannot be deleted unless it is Analyzed');
        
        expect(mockPOFindById).toHaveBeenCalledWith('po-123');
      });
    });

    // Edge cases
    describe('Edge cases', () => {
      test('should throw error for empty string purchase order ID', async () => {
        // Act & Assert
        await expect(validateDeletion.validatePurchaseOrderDeletion('partner123', ''))
          .rejects.toThrow('Invalid purchase order ID');
        
        expect(mockPOFindById).not.toHaveBeenCalled();
      });

      test('should handle valid string IDs', async () => {
        // Arrange - string ID that's valid in the system
        const mockPurchaseOrder = {
          id: 'valid-po-uuid',
          partner_id: 'partner123',
          status: DocumentStatus.ANALYZED
        };
        
        mockPOFindById.mockResolvedValue(mockPurchaseOrder);
        
        // Act
        const result = await validateDeletion.validatePurchaseOrderDeletion('partner123', 'valid-po-uuid');
        
        // Assert
        expect(result).toEqual(mockPurchaseOrder);
        expect(mockPOFindById).toHaveBeenCalledWith('valid-po-uuid');
      });

      test('should throw error for undefined purchase order ID', async () => {
        // Act & Assert
        await expect(validateDeletion.validatePurchaseOrderDeletion('partner123', undefined))
          .rejects.toThrow('Invalid purchase order ID');
        
        expect(mockPOFindById).not.toHaveBeenCalled();
      });
    });
  });
});