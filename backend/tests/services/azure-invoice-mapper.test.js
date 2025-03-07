const { AzureInvoiceMapper } = require('../../src/services/azure-invoice-mapper');
const { mockAzureOcrResult } = require('../mocks/azure-ocr-result');
const { Invoice } = require('../../src/models');

// Mock model untuk test
jest.mock('../../src/models', () => ({
  Invoice: {
    build: jest.fn().mockImplementation(data => data)
  },
  sequelize: {}
}));

describe('AzureInvoiceMapper', () => {
  let mapper;
  const partnerId = "contoso-partner"; // Contoh partnerId untuk test

  beforeEach(() => {
    mapper = new AzureInvoiceMapper();
    jest.clearAllMocks();
  });

  it('should map Azure OCR result to Invoice model format', () => {
    // Given
    const ocrResult = mockAzureOcrResult();
    
    // When (simpan partnerId sebagai argumen kedua)
    const invoiceData = mapper.mapToInvoiceModel(ocrResult, partnerId);
    
    // Then
    expect(invoiceData).toBeDefined();
    expect(invoiceData.purchase_order_id).toBe(12345);
    expect(invoiceData.invoice_date).toEqual(new Date('2023-05-15'));
    expect(invoiceData.due_date).toEqual(new Date('2023-06-15'));
    expect(invoiceData.total_amount).toBe(110);
    expect(invoiceData.subtotal_amount).toBe(100);
    expect(invoiceData.discount_amount).toBe(5);
    expect(invoiceData.payment_terms).toBe('Null');
    expect(invoiceData.status).toBe('Pending');
    expect(invoiceData.partner_id).toBe(partnerId);
  });

  it('should handle missing fields with default values', () => {
    // Given
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
    
    // When (gunakan partnerId sesuai kebutuhan)
    const invoiceData = mapper.mapToInvoiceModel(partialOcrResult, "abc-corp-partner");
    
    // Then
    expect(invoiceData.invoice_date).toEqual(new Date('2023-05-15'));
    expect(invoiceData.total_amount).toBe(500);
    expect(invoiceData.subtotal_amount).toBe(500); // Default ke total jika missing
    expect(invoiceData.purchase_order_id).toBe(0);  // Nilai default
    expect(invoiceData.payment_terms).toBe('Null'); // Nilai default
    expect(invoiceData.status).toBe('Pending');
    expect(invoiceData.partner_id).toBe("abc-corp-partner");
  });

  it('should throw error for invalid date', () => {
    // Given
    const invalidDateResult = {
      documents: [{
        fields: {
          InvoiceDate: { content: 'invalid-date' },
          InvoiceTotal: { content: '$500.00' }
        }
      }]
    };
    
    // When & Then (sisipkan partnerId agar error yang muncul adalah terkait date)
    expect(() => mapper.mapToInvoiceModel(invalidDateResult, "dummy-id"))
      .toThrow('Invalid date format');
  });

  it('should extract line items from OCR result', () => {
    // Given
    const ocrResult = mockAzureOcrResult();
    
    // When
    const invoiceData = mapper.mapToInvoiceModel(ocrResult, partnerId);
    
    // Then
    expect(invoiceData.line_items).toBeDefined();
    expect(invoiceData.line_items.length).toBeGreaterThan(0);
    expect(invoiceData.line_items[0].description).toBe('Consulting Services');
    expect(invoiceData.line_items[0].quantity).toBe(2);
    expect(invoiceData.line_items[0].unitPrice).toBe(30);
    expect(invoiceData.line_items[0].amount).toBe(60);
  });
});
