const { AzureInvoiceMapper } = require('../../src/services/invoiceMapperService');
const { mockAzureOcrResult } = require('../mocks/azure-ocr-result');

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
  it('should throw error when OCR result is invalid', () => {
    // Test for line 10: Invalid OCR format
    expect(() => mapper.mapToInvoiceModel(null, partnerId))
      .toThrow('Invalid OCR result format');
    
    expect(() => mapper.mapToInvoiceModel({}, partnerId))
      .toThrow('Invalid OCR result format');
      
    expect(() => mapper.mapToInvoiceModel({ documents: [] }, partnerId))
      .toThrow('Invalid OCR result format');
  });
  
  it('should throw error when partnerId is missing', () => {
    // Test for line 14: Missing partnerId
    const ocrResult = mockAzureOcrResult();
    
    expect(() => mapper.mapToInvoiceModel(ocrResult))
      .toThrow('Partner ID is required');
      
    expect(() => mapper.mapToInvoiceModel(ocrResult, null))
      .toThrow('Partner ID is required');
      
    expect(() => mapper.mapToInvoiceModel(ocrResult, ''))
      .toThrow('Partner ID is required');
  });
  
  it('should calculate due date based on payment terms', () => {
    // Test for line 79: Payment terms parsing
    const invoiceDate = new Date('2023-05-15');
    
    // Test with numeric terms
    expect(mapper.calculateDueDate(invoiceDate, 'Net 30'))
      .toEqual(new Date('2023-06-14')); // 30 days after invoice date
      
    // Test with non-numeric terms (should default to 30)
    expect(mapper.calculateDueDate(invoiceDate, 'Upon Receipt'))
      .toEqual(new Date('2023-06-14')); // Default to 30 days
      
    // Test with empty terms
    expect(mapper.calculateDueDate(invoiceDate, ''))
      .toEqual(new Date('2023-06-14')); // Default to 30 days
  });
  
  it('should safely handle field content extraction', () => {
    // Test for lines 145-148: getFieldContent edge cases
    expect(mapper.getFieldContent(null)).toBeNull();
    expect(mapper.getFieldContent(undefined)).toBeNull();
    expect(mapper.getFieldContent({})).toBeNull();
    expect(mapper.getFieldContent({ content: 'test' })).toBe('test');
  });
  
  it('should safely handle numeric parsing', () => {
    // Additional test for parseNumeric (might be in lines 145-148)
    expect(mapper.parseNumeric(null)).toBeNull();
    expect(mapper.parseNumeric({ content: 'abc' })).toBeNull(); // NaN case
    expect(mapper.parseNumeric({ content: '123' })).toBe(123);
    expect(mapper.parseNumeric({ content: '123.45' })).toBe(123.45);
  });
  
  it('should generate partner ID from vendor name', () => {
    // Test generatePartnerId function
    expect(mapper.generatePartnerId('Acme Corp Ltd.')).toBe('acme-corp-ltd');
    expect(mapper.generatePartnerId('   Spaces   ')).toBe('spaces');
    expect(mapper.generatePartnerId('')).toBe('unknown-vendor');
    expect(mapper.generatePartnerId(null)).toBe('unknown-vendor');
    
    // Test truncation for long names
    const longName = 'Really Long Company Name That Should Be Truncated To Fit Database Fields';
    expect(mapper.generatePartnerId(longName).length).toBeLessThanOrEqual(44);
  });
  it('should default to current date when date field exists but is empty', () => {
    // Create OCR result with empty invoice date
    const ocrWithEmptyDate = {
      documents: [{
        fields: {
          InvoiceDate: { content: '' }, // Empty string but field exists
          InvoiceTotal: { content: '$100.00' }
        }
      }]
    };
    
    // Call the function
    const now = new Date();
    const invoiceData = mapper.mapToInvoiceModel(ocrWithEmptyDate, partnerId);
    
    // The invoice_date should be close to current date (within 1000ms)
    const timeDiff = Math.abs(invoiceData.invoice_date.getTime() - now.getTime());
    expect(timeDiff).toBeLessThan(1000); // Should be within 1 second
    
    // Alternative test for the parseDate method directly
    const result = mapper.parseDate({ content: '' });
    const resultDiff = Math.abs(result.getTime() - now.getTime());
    expect(resultDiff).toBeLessThan(1000);
  });
  it('should handle edge cases for full branch coverage', () => {
    // Test for line 101-104: parseCurrency with different formats
    expect(mapper.parseCurrency({ content: '£123.45' })).toBe(123.45);
    expect(mapper.parseCurrency({ content: '123.45 EUR' })).toBe(123.45);
    expect(mapper.parseCurrency({ content: 'abc' })).toBeNull();
    
    // Test for line 120: calculateDueDate with unusual payment terms
    expect(mapper.calculateDueDate(new Date('2023-01-01'), 'Terms with no numbers'))
      .toEqual(new Date('2023-01-31')); // Should default to 30 days
    
    // Test for line 18: partnerId edge case validation
    expect(() => mapper.mapToInvoiceModel(mockAzureOcrResult(), undefined))
      .toThrow('Partner ID is required');
  });
  
  it('should handle null inputs for calculateDueDate', () => {
    // Test for line 120: null invoiceDate
    const result = mapper.calculateDueDate(null, 'Net 30');
    // A null invoiceDate actually creates a valid Date using current date
    expect(result instanceof Date).toBe(true);
    // Fix: It returns a valid date (not NaN)
    expect(isNaN(result.getTime())).toBe(false);
  });
  
  it('should properly extract line items with edge cases', () => {
    // Test for line 167: extractLineItems with unusual structure
    const items = {
      valueArray: [
        { valueObject: null }, // Missing valueObject
        { valueObject: {} },   // Empty valueObject
        { 
          valueObject: {
            Description: { content: 'Item' },
            Quantity: { content: 'not-a-number' }
          }
        }
      ]
    };
    
    const result = mapper.extractLineItems(items);
    expect(result.length).toBe(3);
    expect(result[0].description).toBeNull(); // null valueObject
    expect(result[1].description).toBeNull(); // empty valueObject
    expect(result[2].description).toBe('Item');
    expect(result[2].quantity).toBeNull(); // Non-numeric quantity
  });

  it('should handle document without fields property', () => {
    const ocrWithoutFields = {
      documents: [{}]
    };
    
    const result = mapper.mapToInvoiceModel(ocrWithoutFields, partnerId);
    expect(result).toBeDefined();
    expect(result.partner_id).toBe(partnerId);
  });

  it('should handle edge cases in parsePurchaseOrderId', () => {
    expect(mapper.parsePurchaseOrderId({ content: 'ABC-DEF' })).toBe(0);
    expect(mapper.parsePurchaseOrderId({ content: '-' })).toBe(0);
    
    const mockField = { content: '12345e678' };
    const result = mapper.parsePurchaseOrderId(mockField);
    expect(result).toBe(12345678);
    
    expect(mapper.parsePurchaseOrderId({ content: 'Infinity' })).toBe(0);
    expect(mapper.parsePurchaseOrderId({ content: 'NaN' })).toBe(0);
  });

  it('should handle NaN result in parsePurchaseOrderId', () => {
    // We need to mock the parseInt function to force it to return NaN
    const originalParseInt = global.parseInt;
    
    // Override parseInt to always return NaN for this test
    global.parseInt = jest.fn().mockReturnValue(NaN);
    
    const result = mapper.parsePurchaseOrderId({ content: '12345' });
    expect(result).toBe(0); // The isNaN branch should return 0
    
    // Restore original parseInt
    global.parseInt = originalParseInt;
  });
});
