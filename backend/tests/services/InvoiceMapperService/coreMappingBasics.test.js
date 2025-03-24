const { getMapper, partnerId } = require('./setupAzureInvoiceMapper');
const { mockAzureOcrResult } = require('../../mocks/azure-ocr-result');

describe('Core Mapping Basic Functionality', () => {
  it('should map Azure OCR result to Invoice model format', () => {
    const mapper = getMapper();
    const ocrResult = mockAzureOcrResult();
    const { invoiceData } = mapper.mapToInvoiceModel(ocrResult, partnerId);

    expect(invoiceData).toBeDefined();
    expect(invoiceData.purchase_order_id).toBe(12345);
    expect(invoiceData.invoice_date).toEqual(new Date('2023-05-15'));
    expect(invoiceData.due_date).toEqual(new Date('2023-06-15'));
    expect(invoiceData.total_amount).toBe(110);
    expect(invoiceData.subtotal_amount).toBe(100);
    expect(invoiceData.discount_amount).toBe(5);
    expect(invoiceData.payment_terms).toBe('Null');
    expect(invoiceData.status).toBe('Analyzed');
    expect(invoiceData.partner_id).toBe(partnerId);
  });

  it('should handle missing fields with default values', () => {
    const mapper = getMapper();
    const partialOcrResult = {
      documents: [{
        fields: {
          InvoiceId: { content: 'INV-2023-001' },
          InvoiceDate: { content: '2023-05-15' },
          VendorName: { content: 'ABC Corp' },
          InvoiceTotal: { content: '$500.00' }
        }
      }]
    };

    const { invoiceData } = mapper.mapToInvoiceModel(partialOcrResult, "abc-corp-partner");

    expect(invoiceData.invoice_date).toEqual(new Date('2023-05-15'));
    expect(invoiceData.total_amount).toBe(500);
    expect(invoiceData.subtotal_amount).toBe(500);
    expect(invoiceData.purchase_order_id).toBe(null);
    expect(invoiceData.payment_terms).toBe(null);
    expect(invoiceData.status).toBe('Analyzed');
    expect(invoiceData.partner_id).toBe("abc-corp-partner");
  });

  it('should handle document without fields property', () => {
    const mapper = getMapper();
    const ocrWithoutFields = { documents: [{}] };
    const { invoiceData } = mapper.mapToInvoiceModel(ocrWithoutFields, partnerId);
    
    expect(invoiceData).toBeDefined();
    expect(invoiceData.partner_id).toBe(partnerId);
  });
});
