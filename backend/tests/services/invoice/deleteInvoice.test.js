const invoiceService = require('@services/invoice/invoiceService');

// Mock repositories
jest.mock('@repositories/invoiceRepository', () => {
  return jest.fn().mockImplementation(() => ({
    delete: jest.fn()
  }));
});

describe('deleteInvoiceById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should delete an invoice successfully', async () => {
    // Arrange - Mock the delete method to return 1 (success)
    invoiceService.invoiceRepository.delete.mockResolvedValue(1);
    
    // Act
    const result = await invoiceService.deleteInvoiceById('invoice-123');
    
    // Assert
    expect(invoiceService.invoiceRepository.delete).toHaveBeenCalledWith('invoice-123');
    expect(result).toEqual({ message: 'Invoice successfully deleted' });
  });

  test('should throw error when no invoice is deleted', async () => {
    // Arrange - Mock the delete method to return 0 (no records deleted)
    invoiceService.invoiceRepository.delete.mockResolvedValue(0);
    
    // Act & Assert
    await expect(invoiceService.deleteInvoiceById('nonexistent-invoice'))
      .rejects.toThrow('Failed to delete invoice: Failed to delete invoice');
    
    expect(invoiceService.invoiceRepository.delete).toHaveBeenCalledWith('nonexistent-invoice');
  });

  test('should throw error when deletion fails', async () => {
    // Arrange - Mock the delete method to throw an error
    const mockError = new Error('Database connection error');
    invoiceService.invoiceRepository.delete.mockRejectedValue(mockError);
    
    // Act & Assert
    await expect(invoiceService.deleteInvoiceById('invoice-123'))
      .rejects.toThrow('Failed to delete invoice: Database connection error');
    
    expect(invoiceService.invoiceRepository.delete).toHaveBeenCalledWith('invoice-123');
  });
});