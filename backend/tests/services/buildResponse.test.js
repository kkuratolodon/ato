const invoiceService = require('../../src/services/invoiceService');

describe('buildResponse method', () => {
  test('should correctly format response with complete invoice data', () => {
    // Arrange
    const mockInvoice = {
      id: 'invoice-123',
      invoice_number: 'INV-001',
      invoice_date: '2023-07-15',
      due_date: '2023-08-15',
      total_amount: 1250.50,
      status: 'Analyzed',
      created_at: new Date('2023-07-10T12:30:45Z')
    };

    // Act
    const result = invoiceService.buildResponse(mockInvoice);

    // Assert
    expect(result).toEqual({
      message: 'Invoice successfully processed and saved',
      invoiceId: 'invoice-123',
      details: {
        id: 'invoice-123',
        invoice_number: 'INV-001',
        invoice_date: '2023-07-15',
        due_date: '2023-08-15',
        total_amount: 1250.50,
        status: 'Analyzed',
        created_at: mockInvoice.created_at
      }
    });
  });

  test('should handle partial invoice data with missing fields', () => {
    // Arrange
    const partialInvoice = {
      id: 'invoice-456',
      invoice_number: 'INV-002',
      // Missing invoice_date, due_date
      total_amount: 750.25,
      status: 'Processing',
      // Missing created_at
    };

    // Act
    const result = invoiceService.buildResponse(partialInvoice);

    // Assert
    expect(result).toEqual({
      message: 'Invoice successfully processed and saved',
      invoiceId: 'invoice-456',
      details: {
        id: 'invoice-456',
        invoice_number: 'INV-002',
        invoice_date: undefined,
        due_date: undefined,
        total_amount: 750.25,
        status: 'Processing',
        created_at: undefined
      }
    });
  });

  test('should handle minimal invoice data with only ID', () => {
    // Arrange
    const minimalInvoice = {
      id: 'invoice-789'
      // All other fields missing
    };

    // Act
    const result = invoiceService.buildResponse(minimalInvoice);

    // Assert
    expect(result).toEqual({
      message: 'Invoice successfully processed and saved',
      invoiceId: 'invoice-789',
      details: {
        id: 'invoice-789',
        invoice_number: undefined,
        invoice_date: undefined,
        due_date: undefined,
        total_amount: undefined,
        status: undefined,
        created_at: undefined
      }
    });
  });

  test('should map all fields correctly even when they contain falsy values', () => {
    // Arrange
    const invoiceWithFalsyValues = {
      id: 'invoice-000',
      invoice_number: '',
      invoice_date: null,
      due_date: '',
      total_amount: 0,
      status: '',
      created_at: null
    };

    // Act
    const result = invoiceService.buildResponse(invoiceWithFalsyValues);

    // Assert
    expect(result).toEqual({
      message: 'Invoice successfully processed and saved',
      invoiceId: 'invoice-000',
      details: {
        id: 'invoice-000',
        invoice_number: '',
        invoice_date: null,
        due_date: '',
        total_amount: 0,
        status: '',
        created_at: null
      }
    });
  });
});
