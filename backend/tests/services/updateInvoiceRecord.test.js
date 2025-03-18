const invoiceService = require('../../src/services/invoiceService');
const { Invoice } = require('../../src/models');

// Mock the Invoice model
jest.mock('../../src/models', () => {
  return {
    Invoice: {
      update: jest.fn()
    }
  };
});

// Mock console methods to verify they are called
global.console = {
  log: jest.fn(),
  error: jest.fn()
};

describe('updateInvoiceRecord method', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('should return early when invoiceData is undefined', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = undefined;
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(console.error).toHaveBeenCalledWith('Invoice data is undefined!');
    expect(Invoice.update).not.toHaveBeenCalled();
  });
  
  test('should return early when invoiceData is null', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = null;
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(console.error).toHaveBeenCalledWith('Invoice data is undefined!');
    expect(Invoice.update).not.toHaveBeenCalled();
  });
  
  test('should update invoice when invoiceData is provided', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = {
      invoice_number: 'INV-001',
      invoice_date: '2023-01-01'
    };
    
    // Mock successful update
    Invoice.update.mockResolvedValue([1]);
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(Invoice.update).toHaveBeenCalledWith(
      invoiceData, 
      { where: { id: invoiceId } }
    );
    expect(console.log).toHaveBeenCalledWith(`Invoice data updated for ${invoiceId}`);
  });
  
  test('should throw error when update fails', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = { invoice_number: 'INV-001' };
    const error = new Error('Database connection error');
    
    // Mock failed update
    Invoice.update.mockRejectedValue(error);
    
    // Act & Assert
    await expect(
      invoiceService.updateInvoiceRecord(invoiceId, invoiceData)
    ).rejects.toThrow('Failed to update invoice: Database connection error');
    
    expect(console.error).toHaveBeenCalledWith('Error updating invoice:', error);
  });

  test('should handle specific error types correctly when update fails', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = { invoice_number: 'INV-001' };
    
    // Create a custom error with properties
    const customError = new Error('Foreign key constraint violation');
    customError.name = 'SequelizeForeignKeyConstraintError';
    customError.parent = { code: 'ER_NO_REFERENCED_ROW_2' };
    
    // Mock failed update with specific error
    Invoice.update.mockRejectedValue(customError);
    
    // Act & Assert
    await expect(
      invoiceService.updateInvoiceRecord(invoiceId, invoiceData)
    ).rejects.toThrow('Failed to update invoice: Foreign key constraint violation');
    
    // Verify the error was logged correctly
    expect(console.error).toHaveBeenCalledWith('Error updating invoice:', customError);
  });
  
  test('should propagate error with message when error object has no message property', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = { invoice_number: 'INV-001' };
    
    // Create an unusual error without a message property
    const unusualError = { 
      code: 'UNUSUAL_ERROR',
      toString: () => 'String representation of error'
    };
    
    // Mock failed update with unusual error
    Invoice.update.mockRejectedValue(unusualError);
    
    // Act & Assert
    await expect(
      invoiceService.updateInvoiceRecord(invoiceId, invoiceData)
    ).rejects.toThrowError(); // Just check that some error is thrown
    
    // Verify the error was logged
    expect(console.error).toHaveBeenCalledWith('Error updating invoice:', unusualError);
  });
  
  test('should handle nested errors with cause property', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = { invoice_number: 'INV-001' };
    
    // Create a nested error with cause (Node.js v16.9+ feature)
    const nestedError = new Error('Database error');
    nestedError.cause = new Error('Connection timeout');
    
    // Mock failed update with nested error
    Invoice.update.mockRejectedValue(nestedError);
    
    // Act & Assert
    await expect(
      invoiceService.updateInvoiceRecord(invoiceId, invoiceData)
    ).rejects.toThrow('Failed to update invoice: Database error');
    
    // Verify the error was logged with all its details
    expect(console.error).toHaveBeenCalledWith('Error updating invoice:', nestedError);
  });
});
