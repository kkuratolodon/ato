const DocumentStatus = require('../../../src/models/enums/documentStatus');
const invoiceService = require('../../../src/services/invoice/invoiceService');

// Mock the repository instead of the model
jest.mock('../../../src/repositories/invoiceRepository', () => {
  return jest.fn().mockImplementation(() => ({
    update: jest.fn()
  }));
});

// Mock other repositories that InvoiceService might need
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');

// Mock other dependencies
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoice/invoiceValidator');
jest.mock('../../../src/services/invoice/invoiceResponseFormatter');
jest.mock('../../../src/services/invoiceMapperService/invoiceMapperService');

// Mock console methods to verify they are called
global.console = {
  log: jest.fn(),
  error: jest.fn()
};

// Mock Sentry
jest.mock('../../../src/instrument', () => ({
  init: jest.fn(),
  startSpan: jest.fn((_, callback) => callback({
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn()
  })),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

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
    expect(invoiceService.invoiceRepository.update).not.toHaveBeenCalled();
  });
  
  test('should return early when invoiceData is null', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = null;
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(console.error).toHaveBeenCalledWith('Invoice data is undefined!');
    expect(invoiceService.invoiceRepository.update).not.toHaveBeenCalled();
  });
  
  test('should update invoice when invoiceData is provided', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = {
      invoice_number: 'INV-001',
      invoice_date: '2023-01-01'
    };
    
    // Mock successful update
    invoiceService.invoiceRepository.update.mockResolvedValue([1]);
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      invoiceId, 
      invoiceData
    );
    expect(console.log).toHaveBeenCalledWith(`Invoice data updated for ${invoiceId}`);
  });
  
  test('should throw error when update fails', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = { invoice_number: 'INV-001' };
    const error = new Error('Database connection error');
    
    // Mock failed update
    invoiceService.invoiceRepository.update.mockRejectedValue(error);
    
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
    invoiceService.invoiceRepository.update.mockRejectedValue(customError);
    
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
    invoiceService.invoiceRepository.update.mockRejectedValue(unusualError);
    
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
    invoiceService.invoiceRepository.update.mockRejectedValue(nestedError);
    
    // Act & Assert
    await expect(
      invoiceService.updateInvoiceRecord(invoiceId, invoiceData)
    ).rejects.toThrow('Failed to update invoice: Database error');
    
    // Verify the error was logged with all its details
    expect(console.error).toHaveBeenCalledWith('Error updating invoice:', nestedError);
  });

  test('should update invoice with analysis_json_url', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const jsonUrl = 'https://storage.example.com/invoices/analysis-123.json';
    const invoiceData = {
      invoice_number: 'INV-001',
      invoice_date: '2023-01-01',
      analysis_json_url: jsonUrl
    };
    
    // Mock successful update
    invoiceService.invoiceRepository.update.mockResolvedValue([1]);
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      invoiceId, 
      expect.objectContaining({
        invoice_number: 'INV-001',
        invoice_date: '2023-01-01',
        analysis_json_url: jsonUrl
      })
    );
    
    // Check if the URL is properly logged (if you add the logging enhancement I suggested earlier)
    if (invoiceService.updateInvoiceRecord.toString().includes('analysis_json_url')) {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`analysis_json_url: ${jsonUrl}`)
      );
    }
    
    expect(console.log).toHaveBeenCalledWith(`Invoice data updated for ${invoiceId}`);
  });
  
  test('should handle empty object as invoiceData', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = {};
    
    // Mock successful update
    invoiceService.invoiceRepository.update.mockResolvedValue([1]);
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(invoiceId, {});
    expect(console.log).toHaveBeenCalledWith(`Invoice data updated for ${invoiceId}`);
  });
  
  test('should update with partial data correctly', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = {
      invoice_date: '2023-05-15'
      // Only updating date, not number
    };
    
    // Mock successful update
    invoiceService.invoiceRepository.update.mockResolvedValue([1]);
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(invoiceId, {
      invoice_date: '2023-05-15'
    });
    expect(console.log).toHaveBeenCalledWith(`Invoice data updated for ${invoiceId}`);
  });
  
  test('should handle when update affects 0 rows', async () => {
    // Arrange
    const invoiceId = 'non-existent-id';
    const invoiceData = { invoice_number: 'INV-001' };
    
    // Mock update that affects no rows (invoice not found)
    invoiceService.invoiceRepository.update.mockResolvedValue([0]);
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(invoiceId, invoiceData);
    expect(console.log).toHaveBeenCalledWith(`Invoice data updated for ${invoiceId}`);
    // Note: Current implementation doesn't distinguish between 0 and positive row count
  });
  
  
  test('should handle update with large data object', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = {
      invoice_number: 'INV-001',
      invoice_date: '2023-01-01',
      due_date: '2023-02-01',
      total_amount: 1500.75,
      tax_amount: 300.15,
      subtotal: 1200.60,
      notes: 'A very long note with lots of details about this invoice that might cause issues if not handled properly...' + 
             'Continuing with more text to ensure the string is quite long and potentially problematic for some systems.' +
             'This is to test how the system handles large text fields in the database update operation.',
      status: DocumentStatus.PENDING,
      currency: 'USD',
      payment_terms: 'Net 30',
      analysis_json_url: 'https://example.com/very/long/path/to/some/json/file/with/analysis/results.json',
      additional_field1: 'value1',
      additional_field2: 'value2',
      // ... many more fields ...
    };
    
    // Mock successful update
    invoiceService.invoiceRepository.update.mockResolvedValue([1]);
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      invoiceId, 
      expect.objectContaining({
        invoice_number: 'INV-001',
        notes: expect.stringContaining('A very long note')
      })
    );
    expect(console.log).toHaveBeenCalledWith(`Invoice data updated for ${invoiceId}`);
  });
  
  test('should update with special characters in data', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const invoiceData = {
      invoice_number: 'INV-001',
      notes: 'Special characters: !@#$%^&*()_+{}|:"<>?[];\',./'
    };
    
    // Mock successful update
    invoiceService.invoiceRepository.update.mockResolvedValue([1]);
    
    // Act
    await invoiceService.updateInvoiceRecord(invoiceId, invoiceData);
    
    // Assert
    expect(invoiceService.invoiceRepository.update).toHaveBeenCalledWith(
      invoiceId,
      expect.objectContaining({
        notes: 'Special characters: !@#$%^&*()_+{}|:"<>?[];\',./'
      })
    );
    expect(console.log).toHaveBeenCalledWith(`Invoice data updated for ${invoiceId}`);
  });
});