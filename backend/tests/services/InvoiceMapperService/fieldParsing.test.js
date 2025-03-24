const { AzureInvoiceMapper } = require('../../../src/services/invoiceMapperService');
const { getMapper, partnerId } = require('./setupAzureInvoiceMapper');

describe('Field Parsing', () => {
    it('should safely handle field content extraction', () => {
      const mapper = getMapper();
      expect(mapper.getFieldContent(null)).toBeNull();
      expect(mapper.getFieldContent(undefined)).toBeNull();
      expect(mapper.getFieldContent({})).toBeNull();
      expect(mapper.getFieldContent({ content: 'test' })).toBe('test');
      
      const fieldWithDirectValue = { value: 'direct value', content: null };
      expect(mapper.getFieldContent(fieldWithDirectValue)).toBe('direct value');
      
      const fieldWithTextInValue = { value: { text: 'text in value object' }, content: null };
      expect(mapper.getFieldContent(fieldWithTextInValue)).toBe('text in value object');
    });
    
    it('should return null for fields with unexpected data structure', () => {
      const mapper = getMapper();
      const unexpectedStructure = { 
        someProperty: 'value',
        nestedObject: { anotherProperty: 'another value' }
      };
      
      expect(mapper.getFieldContent(unexpectedStructure)).toBeNull();
    });
    
    it('should safely handle numeric parsing', () => {
      const mapper = getMapper();
      expect(mapper.parseNumeric(null)).toBeNull();
      expect(mapper.parseNumeric({ content: 'abc' })).toBeNull();
      expect(mapper.parseNumeric({ content: '123' })).toBe(123);
      expect(mapper.parseNumeric({ content: '123.45' })).toBe(123.45);
      
      // Direct numeric value tests
      expect(mapper.parseNumeric({ value: 42 })).toBe(42);
      expect(mapper.parseNumeric({})).toBeNull();
      expect(mapper.parseNumeric({ value: "a" })).toBeNull();
    });
    
    it('should explicitly handle all branches of direct numeric value check', () => {
      const mapper = getMapper();
      expect(mapper.parseNumeric(null)).toBeNull();
      expect(mapper.parseNumeric(undefined)).toBeNull();
      expect(mapper.parseNumeric({})).toBeNull();
      
      const nonNumberValues = [
        { value: 'tes' },
        { value: true },
        { value: [] },
        { value: {} },
        { value: null }
      ];
      
      nonNumberValues.forEach(field => {
        expect(mapper.parseNumeric(field)).toBeNull();
      });
      
      expect(mapper.parseNumeric({ value: 42 })).toBe(42);
      expect(mapper.parseNumeric({ value: 0 })).toBeNull();
      expect(mapper.parseNumeric({ value: -1.5 })).toBe(-1.5);
    });
    
    it('should parse currency values correctly', () => {
      const mapper = getMapper();
      // Test cases for string content
      expect(mapper.parseCurrency({ content: '$123.45' })).toEqual({ amount: 123.45, currency: { currencySymbol: '$', currencyCode: null } });
      expect(mapper.parseCurrency({ content: '£123.45' })).toEqual({ amount: 123.45, currency: { currencySymbol: '£', currencyCode: null } });
      expect(mapper.parseCurrency({ content: '123.45 EUR' })).toEqual({ amount: 123.45, currency: { currencySymbol: null, currencyCode: null } });
      expect(mapper.parseCurrency({ content: 'abc' })).toEqual({ amount: null, currency: { currencySymbol: null, currencyCode: null } });
    
      // Test case for structured currency field
      const structuredCurrencyField = {
        value: {
          amount: 129.99,
          currencyCode: 'USD',
          currencySymbol: '$'
        }
      };
      expect(mapper.parseCurrency(structuredCurrencyField)).toEqual({ amount: 129.99, currency: { currencySymbol: '$', currencyCode: 'USD' } });
    
      // Test case for direct number value
      expect(mapper.parseCurrency({ value: 42 })).toEqual({ amount: 42, currency: { currencySymbol: null, currencyCode: null } });
    
      // Test case for null field
      expect(mapper.parseCurrency(null)).toEqual({ amount: null, currency: { currencySymbol: null, currencyCode: null } });
    });
    it('should correctly parse Rupiah currency format', () => {
      const mapper = new AzureInvoiceMapper();
      
      // Test structured currency field with Rupiah content
      const rupiahField = {
        value: {
          amount: 100000, // This value should be overridden by the parsed content
          currencySymbol: '$', // This should be replaced with Rp
          currencyCode: 'USD' // This should be replaced with IDR
        },
        content: 'Rp67.998'
      };
      
      const result = mapper.parseCurrency(rupiahField);
      
      // Should parse Indonesian number format (67.998 → 67998)
      expect(result.amount).toBe(67998);
      expect(result.currency.currencySymbol).toBe('Rp');
      expect(result.currency.currencyCode).toBe('IDR');
      
      // Test with decimal comma
      const rupiahWithDecimal = {
        value: {
          amount: 50000
        },
        content: 'Rp45.750,50'
      };
      
      const resultWithDecimal = mapper.parseCurrency(rupiahWithDecimal);
      // 45.750,50 should be converted to 45750.50
      expect(resultWithDecimal.amount).toBe(45750.50);
      expect(resultWithDecimal.currency.currencySymbol).toBe('Rp');
      expect(resultWithDecimal.currency.currencyCode).toBe('IDR');
      
      // Test with no thousands separator
      const simplifiedRupiah = {
        value: {
          amount: 1000
        },
        content: 'Rp5000'
      };
      
      const simpleResult = mapper.parseCurrency(simplifiedRupiah);
      expect(simpleResult.amount).toBe(5000);
      expect(simpleResult.currency.currencySymbol).toBe('Rp');
      expect(simpleResult.currency.currencyCode).toBe('IDR');
    });
    it('should handle edge cases in parsePurchaseOrderId', () => {
      const mapper = getMapper();
      expect(mapper.parsePurchaseOrderId({ content: '12345' })).toBe(12345);
      expect(mapper.parsePurchaseOrderId({ content: 'ABC-DEF' })).toBe(0);
      expect(mapper.parsePurchaseOrderId({ content: '-' })).toBe(0);
      expect(mapper.parsePurchaseOrderId({ content: '12345e678' })).toBe(12345678);
      expect(mapper.parsePurchaseOrderId({ content: 'Infinity' })).toBe(0);
      expect(mapper.parsePurchaseOrderId({ content: 'NaN' })).toBe(0);
    });
    
    it('should handle tax field variations', () => {
      const mapper = getMapper();
      const ocrWithTaxVariations = {
        documents: [{
          fields: {
            TotalTax: { content: '15.00' },
            Tax: { content: '10.00' }
          }
        }]
      };
      
      const { invoiceData } = mapper.mapToInvoiceModel(ocrWithTaxVariations, partnerId);
      expect(invoiceData.tax_amount).toBe(15); // Should use TotalTax first
    });
  });