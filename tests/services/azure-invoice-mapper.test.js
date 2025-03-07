const { AzureInvoiceMapper } = require('../../src/services/azure-invoice-mapper');
const { mockAzureAnalysisResult } = require('../mocks/azure-analysis-result');
const { Invoice } = require('../../src/models/invoice');

describe('AzureInvoiceMapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = new AzureInvoiceMapper();
  });

  it('should map Azure analysis result to Invoice model', () => {
    // Given
    const azureResult = mockAzureAnalysisResult();

    // When
    const invoice = mapper.mapToInvoice(azureResult);

    // Then
    expect(invoice).toBeInstanceOf(Invoice);
    expect(invoice.invoiceNumber).toBe(azureResult.invoiceNumber);
    expect(invoice.issueDate).toEqual(new Date(azureResult.invoiceDate));
    expect(invoice.dueDate).toEqual(azureResult.dueDate ? new Date(azureResult.dueDate) : undefined);
    expect(invoice.vendorName).toBe(azureResult.vendorName);
    expect(invoice.vendorAddress).toBe(azureResult.vendorAddress);
    expect(invoice.customerName).toBe(azureResult.customerName);
    expect(invoice.customerAddress).toBe(azureResult.customerAddress);
    expect(invoice.totalAmount).toBe(azureResult.totalAmount);
    expect(invoice.taxAmount).toBe(azureResult.taxAmount);
    expect(invoice.currency).toBe(azureResult.currency);
  });

  it('should handle missing fields from Azure analysis', () => {
    // Given
    const partialAzureResult = {
      invoiceNumber: 'INV-123',
      invoiceDate: '2023-05-15',
      vendorName: 'ABC Corp',
      totalAmount: 1000
    };

    // When
    const invoice = mapper.mapToInvoice(partialAzureResult);

    // Then
    expect(invoice.invoiceNumber).toBe('INV-123');
    expect(invoice.issueDate).toEqual(new Date('2023-05-15'));
    expect(invoice.dueDate).toBeUndefined();
    expect(invoice.vendorName).toBe('ABC Corp');
    expect(invoice.vendorAddress).toBeUndefined();
    expect(invoice.customerName).toBeUndefined();
    expect(invoice.customerAddress).toBeUndefined();
    expect(invoice.totalAmount).toBe(1000);
    expect(invoice.taxAmount).toBeUndefined();
    expect(invoice.currency).toBeUndefined();
  });

  it('should correctly map line items if available', () => {
    // Given
    const azureResultWithLineItems = {
      ...mockAzureAnalysisResult(),
      lineItems: [
        { description: 'Item 1', quantity: 2, unitPrice: 100, amount: 200 },
        { description: 'Item 2', quantity: 1, unitPrice: 50, amount: 50 }
      ]
    };

    // When
    const invoice = mapper.mapToInvoice(azureResultWithLineItems);

    // Then
    expect(invoice.lineItems).toHaveLength(2);
    expect(invoice.lineItems[0].description).toBe('Item 1');
    expect(invoice.lineItems[0].quantity).toBe(2);
    expect(invoice.lineItems[0].unitPrice).toBe(100);
    expect(invoice.lineItems[0].amount).toBe(200);
    expect(invoice.lineItems[1].description).toBe('Item 2');
  });

  it('should throw error for invalid date format', () => {
    // Given
    const resultWithInvalidDate = {
      ...mockAzureAnalysisResult(),
      invoiceDate: 'invalid-date'
    };

    // When & Then
    expect(() => mapper.mapToInvoice(resultWithInvalidDate))
      .toThrow('Invalid date format in Azure analysis result');
  });
});
