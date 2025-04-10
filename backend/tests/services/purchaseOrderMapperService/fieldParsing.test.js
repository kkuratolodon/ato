const { AzurePurchaseOrderMapper } = require('../../../src/services/purchaseOrderMapperService/purchaseOrderMapperService');
const { getMapper, partnerId } = require('./setupAzurePurchaseOrderMapper');

describe('PO Field Parsing', () => {
    it('should safely handle field content extraction', () => {
      const mapper = getMapper();
      expect(mapper.fieldParser.getFieldContent(null)).toBeNull();
      expect(mapper.fieldParser.getFieldContent(undefined)).toBeNull();
      expect(mapper.fieldParser.getFieldContent({})).toBeNull();
      expect(mapper.fieldParser.getFieldContent({ content: 'test' })).toBe('test');
      
      const fieldWithDirectValue = { value: 'direct value', content: null };
      expect(mapper.fieldParser.getFieldContent(fieldWithDirectValue)).toBe('direct value');
      
      const fieldWithTextInValue = { value: { text: 'text in value object' }, content: null };
      expect(mapper.fieldParser.getFieldContent(fieldWithTextInValue)).toBe('text in value object');
    });
    
    it('should return null for fields with unexpected data structure', () => {
      const mapper = getMapper();
      const unexpectedStructure = { 
        someProperty: 'value',
        nestedObject: { anotherProperty: 'another value' }
      };
      
      expect(mapper.fieldParser.getFieldContent(unexpectedStructure)).toBeNull();
    });
    
    it('should safely handle numeric parsing', () => {
      const mapper = getMapper();
      expect(mapper.fieldParser.parseNumeric(null)).toBeNull();
      expect(mapper.fieldParser.parseNumeric({ content: 'abc' })).toBeNull();
      expect(mapper.fieldParser.parseNumeric({ content: '123' })).toBe(123);
      expect(mapper.fieldParser.parseNumeric({ content: '123.45' })).toBe(123.45);
      
      // Direct numeric value tests
      expect(mapper.fieldParser.parseNumeric({ value: 42 })).toBe(42);
      expect(mapper.fieldParser.parseNumeric({})).toBeNull();
      expect(mapper.fieldParser.parseNumeric({ value: "a" })).toBeNull();
    });
    
    it('should parse currency values correctly for PO data', () => {
      const mapper = getMapper();
      // Test cases for string content
      expect(mapper.fieldParser.parseCurrency({ content: '$123.45' })).toEqual({ amount: 123.45, currency: { currencySymbol: '$', currencyCode: null } });
      expect(mapper.fieldParser.parseCurrency({ content: '£123.45' })).toEqual({ amount: 123.45, currency: { currencySymbol: '£', currencyCode: null } });
      expect(mapper.fieldParser.parseCurrency({ content: '123.45 EUR' })).toEqual({ amount: 123.45, currency: { currencySymbol: null, currencyCode: null } });
      
      // Test case for structured currency field
      const structuredCurrencyField = {
        value: {
          amount: 129.99,
          currencyCode: 'USD',
          currencySymbol: '$'
        }
      };
      expect(mapper.fieldParser.parseCurrency(structuredCurrencyField)).toEqual({ amount: 129.99, currency: { currencySymbol: '$', currencyCode: 'USD' } });
    
      // Test case for direct number value
      expect(mapper.fieldParser.parseCurrency({ value: 42 })).toEqual({ amount: 42, currency: { currencySymbol: null, currencyCode: null } });
    });
    
    it('should handle tax field variations in PO data', () => {
      const mapper = getMapper();
      const ocrWithTaxVariations = {
        documents: [{
          fields: {
            TotalTax: { content: '15.00' },
            Tax: { content: '10.00' }
          }
        }]
      };
      
      const { purchaseOrderData } = mapper.mapToPurchaseOrderModel(ocrWithTaxVariations, partnerId);
      expect(purchaseOrderData.tax_amount).toBe(15); // Should use TotalTax first
    });
});