// Mock the repository before requiring the module that uses it
jest.mock('../../src/repositories/invoiceRepository');

// Now import the modules
const validateDeletion = require('../../src/services/validateDeletion');
const InvoiceRepository = require('../../src/repositories/invoiceRepository');
const DocumentStatus = require('../../src/models/enums/DocumentStatus');

describe('ValidateDeletion Service', () => {
  let mockFindById;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup the mock implementation for findById
    mockFindById = jest.fn();
    
    // Create a proper mock for the repository
    InvoiceRepository.mockImplementation(() => {
      return {
        findById: mockFindById
      };
    });
    
    // Replace the repository instance in validateDeletion with our mock
    validateDeletion.invoiceRepository = new InvoiceRepository();
  });

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