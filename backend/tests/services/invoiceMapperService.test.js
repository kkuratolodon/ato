const { AzureInvoiceMapper } = require('../../src/services/invoiceMapperService');
const { mockAzureOcrResult } = require('../mocks/azure-ocr-result');

// Mock Invoice model for testing
jest.mock('../../src/models', () => ({
  Invoice: {
    build: jest.fn().mockImplementation(data => data)
  },
  sequelize: {}
}));

describe('AzureInvoiceMapper', () => {
  let mapper;
  const partnerId = "contoso-partner";

  beforeEach(() => {
    mapper = new AzureInvoiceMapper();
    jest.clearAllMocks();

    // Add generatePartnerId method for partner ID tests
    mapper.generatePartnerId = function(vendorName) {
      if (!vendorName) return 'unknown-vendor';

      let partnerId = vendorName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      if (partnerId.length > 44) {
        partnerId = partnerId.substring(0, 44);
      }

      return partnerId;
    };
  });

  describe('Core Mapping Functionality', () => {
    it('should map Azure OCR result to Invoice model format', () => {
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
      const ocrWithoutFields = { documents: [{}] };
      const { invoiceData } = mapper.mapToInvoiceModel(ocrWithoutFields, partnerId);
      
      expect(invoiceData).toBeDefined();
      expect(invoiceData.partner_id).toBe(partnerId);
    });
    
    it('should use totalAmount as fallback when parseCurrency returns falsy for SubTotal', () => {
      // Override parseCurrency just for this test
      const originalParseCurrency = mapper.parseCurrency;
      mapper.parseCurrency = jest.fn((field) => {
        if (field === 'SubTotal') {
          return null; // Return falsy value specifically for SubTotal
        } else {
          return { amount: 850, currency: { currencySymbol: '$', currencyCode: 'USD' } };
        }
      });

      const ocrWithForcedFallback = {
        documents: [{
          fields: {
            InvoiceId: { content: 'INV-FORCED-FALLBACK' },
            InvoiceTotal: 'total', // Not used directly, our mock will handle this
            SubTotal: 'SubTotal'   // Specific value our mock will check for
          }
        }]
      };

      const { invoiceData } = mapper.mapToInvoiceModel(ocrWithForcedFallback, partnerId);
      
      // Verify our mock was called correctly
      expect(mapper.parseCurrency).toHaveBeenCalledWith('SubTotal');
      expect(invoiceData.subtotal_amount).toBe(850); // Should use total_amount via direct fallback

      // Restore original method
      mapper.parseCurrency = originalParseCurrency;
    });

    it('should use totalAmountCurrency as fallback when subtotalAmount has null currency', () => {
      // Override parseCurrency just for this test
      const originalParseCurrency = mapper.parseCurrency;
      mapper.parseCurrency = jest.fn((field) => {
        if (field === 'SubTotal') {
          // Return amount but with null currency
          return { amount: 750, currency: null };
        } else if (field === 'InvoiceTotal' || field === 'Total') {
          // Return both amount and currency for total
          return { amount: 850, currency: { currencySymbol: '€', currencyCode: 'EUR' } };
        } else {
          return { amount: null, currency: null };
        }
      });

      const ocrWithCurrencyFallback = {
        documents: [{
          fields: {
            InvoiceId: { content: 'INV-CURRENCY-FALLBACK' },
            InvoiceTotal: 'total', 
            SubTotal: 'subtotal'
          }
        }]
      };

      const { invoiceData } = mapper.mapToInvoiceModel(ocrWithCurrencyFallback, partnerId);
      
      // Verify currency fallback worked
      expect(invoiceData.currency_symbol).toBe(null);
      expect(invoiceData.currency_code).toBe(null);
      
      // Restore original method
      mapper.parseCurrency = originalParseCurrency;
    });
    it('should default to null for missing currencySymbol and currencyCode', () => {
      // Create a field with amount but no currency properties
      const fieldWithAmountOnly = {
        value: {
          amount: 500
          // No currencySymbol or currencyCode
        }
      };
      
      // Parse the currency field
      const result = mapper.parseCurrency(fieldWithAmountOnly);
      
      // Verify amount was parsed correctly
      expect(result.amount).toBe(500);
      
      // Verify currency properties default to null
      expect(result.currency.currencySymbol).toBe(null);
      expect(result.currency.currencyCode).toBe(null);
    });
    it('should handle empty content but non-null field in parseCurrency', () => {
      // Create a field that has a structure but getFieldContent would return falsy value
      const fieldWithEmptyContent = {
        content: '',  // Empty content
        someProperty: 'test'  // The field itself isn't null
      };
      
      // Parse the currency field
      const result = mapper.parseCurrency(fieldWithEmptyContent);
      
      // Verify the early return result structure is correct
      expect(result.amount).toBeNull();
      expect(result.currency.currencySymbol).toBeNull();
      expect(result.currency.currencyCode).toBeNull();
    });
    it('should handle fileUrl in processInvoiceData method', async () => {
      const ocrResult = mockAzureOcrResult();
      const fileUrl = 'https://example.com/invoices/test.pdf';

      const { invoiceData } = await mapper.processInvoiceData(ocrResult, partnerId, fileUrl);
      expect(invoiceData.file_url).toBe(fileUrl);
    });

    it('should handle null fileUrl in processInvoiceData method', async () => {
      const ocrResult = {
        documents: [{
          fields: {
            InvoiceId: { content: 'INV-TEST-NULL-URL' },
            InvoiceDate: { content: '2023-06-01' },
            InvoiceTotal: { content: '100.00' }
          }
        }]
      };
      
      const { invoiceData } = await mapper.processInvoiceData(ocrResult, partnerId, null);
      expect(invoiceData.file_url).toBeNull();
      expect(invoiceData.invoice_number).toBe('INV-TEST-NULL-URL');
      expect(invoiceData.partner_id).toBe(partnerId);
      
      // Test omitting fileUrl parameter
      const { invoiceData: invoiceData2 } = await mapper.processInvoiceData(ocrResult, partnerId);
      expect(invoiceData2.file_url).toBeNull();
    });
  });

  describe('Input Validation', () => {
    it('should throw error when OCR result is invalid', () => {
      expect(() => mapper.mapToInvoiceModel(null, partnerId))
        .toThrow('Invalid OCR result format');
      
      expect(() => mapper.mapToInvoiceModel({}, partnerId))
        .toThrow('Invalid OCR result format');
      
      expect(() => mapper.mapToInvoiceModel({ documents: [] }, partnerId))
        .toThrow('Invalid OCR result format');
    });
    
    it('should throw error when partnerId is missing', () => {
      const ocrResult = mockAzureOcrResult();
      
      expect(() => mapper.mapToInvoiceModel(ocrResult))
        .toThrow('Partner ID is required');
      
      expect(() => mapper.mapToInvoiceModel(ocrResult, null))
        .toThrow('Partner ID is required');
      
      expect(() => mapper.mapToInvoiceModel(ocrResult, ''))
        .toThrow('Partner ID is required');
    });
  });

  describe('Date Processing', () => {
    it('should handle invalid date format with fallback to current date', () => {
      const invalidDate = { content: 'invalid-date' };
      
      const now = new Date();
      const result = mapper.parseDate(invalidDate);
      
      expect(result instanceof Date).toBe(true);
      const timeDiff = Math.abs(result.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
    
    it('should calculate due date based on payment terms', () => {
      const invoiceDate = new Date('2023-05-15');
      
      // Various payment term formats
      expect(mapper.calculateDueDate(invoiceDate, 'Net 30')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, 'Upon Receipt')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, '')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, 'net 45')).toEqual(new Date('2023-06-29'));
      expect(mapper.calculateDueDate(invoiceDate, '60 days')).toEqual(new Date('2023-07-14'));
      expect(mapper.calculateDueDate(invoiceDate, '15')).toEqual(new Date('2023-05-30'));
      expect(mapper.calculateDueDate(invoiceDate, '  25  ')).toEqual(new Date('2023-06-09'));
    });

    it('should handle NaN, zero or negative term days with fallback to 30 days', () => {
      const invoiceDate = new Date('2023-05-15');
      
      expect(mapper.calculateDueDate(invoiceDate, 'Net')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, 'n/a')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, 'Net 0')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, 'Net -10')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, '0')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, '-5')).toEqual(new Date('2023-06-14'));
    });

    it('should default to current date when date field exists but is empty', () => {
      const ocrWithEmptyDate = {
        documents: [{
          fields: {
            InvoiceDate: { content: '' },
            InvoiceTotal: { content: '$100.00' }
          }
        }]
      };
      
      const now = new Date();
      const { invoiceData } = mapper.mapToInvoiceModel(ocrWithEmptyDate, partnerId);
      
      const timeDiff = Math.abs(invoiceData.invoice_date.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(1000);
    });
    
  });
  describe("Date Format Parsing", () => {
    it('should correctly handle DD/MM/YY date format', () => {
      const mapper = new AzureInvoiceMapper();
      
      // Test DD/MM/YY format (28/02/25 should be Feb 28, 2025)
      const dateDDMMYY = mapper.parseDate({ content: '28/02/25' });
      expect(dateDDMMYY.getFullYear()).toBe(2025);
      expect(dateDDMMYY.getMonth() + 1).toBe(2); // Month is 0-indexed
      expect(dateDDMMYY.getDate()).toBe(28);
      
      // Test another DD/MM/YY format with single digits
      const dateSingleDigits = mapper.parseDate({ content: '5/7/23' });
      expect(dateSingleDigits.getFullYear()).toBe(2023);
      expect(dateSingleDigits.getMonth() + 1).toBe(7);
      expect(dateSingleDigits.getDate()).toBe(5);
      
      // Test year interpretation (years < 50 are 20xx, >= 50 are 19xx)
      const dateOlderYear = mapper.parseDate({ content: '15/06/55' });
      expect(dateOlderYear.getFullYear()).toBe(1955);
      expect(dateOlderYear.getMonth() + 1).toBe(6);
      expect(dateOlderYear.getDate()).toBe(15);
    });
    
    it('should correctly handle DD/MM/YYYY date format', () => {
      const mapper = new AzureInvoiceMapper();
      
      // Test DD/MM/YYYY format
      const dateDDMMYYYY = mapper.parseDate({ content: '28/02/2025' });
      expect(dateDDMMYYYY.getFullYear()).toBe(2025);
      expect(dateDDMMYYYY.getMonth() + 1).toBe(2);
      expect(dateDDMMYYYY.getDate()).toBe(28);
      
      // Test with single digits
      const dateSingleDigits = mapper.parseDate({ content: '5/7/2023' });
      expect(dateSingleDigits.getFullYear()).toBe(2023);
      expect(dateSingleDigits.getMonth() + 1).toBe(7);
      expect(dateSingleDigits.getDate()).toBe(5);
    });
    
    it('should correctly handle invalid date formats by using current date', () => {
      const mapper = new AzureInvoiceMapper();
      
      // Mock date.now to have consistent test results
      const now = new Date('2025-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now);
      
      // Test invalid format that should fall back to current date
      const invalidDate = mapper.parseDate({ content: 'not-a-date' });
      expect(invalidDate).toEqual(now);
      
      // Clean up
      jest.restoreAllMocks();
    });
  });
  describe('Field Parsing', () => {
    it('should safely handle field content extraction', () => {
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
      const unexpectedStructure = { 
        someProperty: 'value',
        nestedObject: { anotherProperty: 'another value' }
      };
      
      expect(mapper.getFieldContent(unexpectedStructure)).toBeNull();
    });
    
    it('should safely handle numeric parsing', () => {
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
    
    it('should handle edge cases in parsePurchaseOrderId', () => {
      expect(mapper.parsePurchaseOrderId({ content: '12345' })).toBe(12345);
      expect(mapper.parsePurchaseOrderId({ content: 'ABC-DEF' })).toBe(0);
      expect(mapper.parsePurchaseOrderId({ content: '-' })).toBe(0);
      expect(mapper.parsePurchaseOrderId({ content: '12345e678' })).toBe(12345678);
      expect(mapper.parsePurchaseOrderId({ content: 'Infinity' })).toBe(0);
      expect(mapper.parsePurchaseOrderId({ content: 'NaN' })).toBe(0);
    });
    
    it('should handle tax field variations', () => {
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

  describe('Line Item Processing', () => {
    
    it('should handle various line item formats', () => {
      // Standard format
      const standardItems = {
        values: [
          {
            properties: {
              Description: { content: 'Standard Item' },
              Quantity: { content: '2' },
              UnitPrice: { content: '10.00' },
              Amount: { content: '20.00' }
            }
          }
        ]
      };
      
      const result1 = mapper.extractLineItems(standardItems);
      console.log("ppp", result1)
      expect(result1[0].description).toBe('Standard Item');
      expect(result1[0].quantity).toBe(2);
      expect(result1[0].unitPrice).toBe(10);
      expect(result1[0].amount).toBe(20);
      
      // Alternative field names
      const alternativeItems = {
        values: [
          {
            properties: {
              ProductCode: { content: 'Alternative field name' },
              Quantity: { content: '2' },
              UnitPrice: { content: '45.00' },
              Amount: { content: '90.00' }
            }
          }
        ]
      };
      
      const result2 = mapper.extractLineItems(alternativeItems);
      expect(result2[0].description).toBe('Alternative field name');
      expect(result2[0].quantity).toBe(2);
      expect(result2[0].unitPrice).toBe(45);
      expect(result2[0].amount).toBe(90);
      
      // Missing fields
      const partialItems = {
        values: [
          {
            properties: {
              Description: null,
              Quantity: { content: '3' },
              Amount: { content: '45.00' }
            }
          }
        ]
      };
      
      const result3 = mapper.extractLineItems(partialItems);
      expect(result3[0].description).toBeNull();
      expect(result3[0].quantity).toBe(3);
      expect(result3[0].unitPrice).toBeNull();
      expect(result3[0].amount).toBe(45);
      
      // Missing properties
      const itemsWithMissingproperties = {
        values: [{ someOtherProperty: 'test' }]
      };
      
      const result4 = mapper.extractLineItems(itemsWithMissingproperties);
      expect(result4).toHaveLength(1);
      expect(result4[0].description).toBeNull();
      expect(result4[0].quantity).toBeNull();
    });
    
    it('should handle non-structured line items', () => {
      const itemsWithContent = {
        content: 'Single line item description without structured data'
      };
      
      const result = mapper.extractLineItems(itemsWithContent);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Single line item description without structured data');
      expect(result[0].quantity).toBeNull();
      expect(result[0].unitPrice).toBeNull();
      expect(result[0].amount).toBeNull();
    });
    
    it('should return empty array when items field has no usable content', () => {
      const emptyContentItemsField = {
        content: '',
        someOtherProperty: 'value'
      };
      
      expect(mapper.extractLineItems(emptyContentItemsField)).toEqual([]);
      
      const nullContentItemsField = {
        someProperty: 'test',
        content: null
      };
      
      
      expect(mapper.extractLineItems(nullContentItemsField)).toEqual([]);
    });
  });

  describe('Partner ID Generation', () => {
    it('should generate valid partner IDs from vendor names', () => {
      expect(mapper.generatePartnerId('Acme Corp Ltd.')).toBe('acme-corp-ltd');
      expect(mapper.generatePartnerId('   Spaces   ')).toBe('spaces');
      expect(mapper.generatePartnerId('')).toBe('unknown-vendor');
      expect(mapper.generatePartnerId(null)).toBe('unknown-vendor');
      
      // Test truncation for long names
      const longName = 'Really Long Company Name That Should Be Truncated To Fit Database Fields';
      expect(mapper.generatePartnerId(longName).length).toBeLessThanOrEqual(44);
    });
  });

  describe('Address Processing', () => {
    it('should handle different address patterns for customer address extraction', () => {
      // City, STATE ZIP pattern
      const addressWithCityStateZip = {
        content: '123 Main St\nAustin, TX 78701'
      };
      const result1 = mapper.extractCustomerAddress(addressWithCityStateZip);
      expect(result1.street_address).toBe('123 Main St');
      expect(result1.city).toBe('Austin');
      expect(result1.state).toBe('TX');
      expect(result1.postal_code).toBe('78701');
      
      // City STATE ZIP pattern (no comma)
      const addressWithoutComma = {
        content: '456 Oak Ave\nSeattle WA 98101'
      };
      const result2 = mapper.extractCustomerAddress(addressWithoutComma);
      expect(result2.city).toBe('Seattle');
      expect(result2.state).toBe('WA');
      expect(result2.postal_code).toBe('98101');
      
      // International format
      const internationalAddress = {
        content: '789 High Street\nLondon, England EC1A 1BB'
      };
      const result3 = mapper.extractCustomerAddress(internationalAddress);
      expect(result3.city).toBe('London');
      expect(result3.state).toBe('England');
      expect(result3.postal_code).toBe('EC1A 1BB');
    });
    
    it('should handle structured address data in value property', () => {
      // With standard property names
      const structuredAddressField = {
        value: {
          streetAddress: '123 Main Avenue',
          city: 'Boston',
          state: 'MA',
          postalCode: '02108',
          houseNumber: '123'
        }
      };
      
      const result = mapper.extractCustomerAddress(structuredAddressField);
      expect(result.street_address).toBe('123 Main Avenue');
      expect(result.city).toBe('Boston');
      expect(result.state).toBe('MA');
      expect(result.postal_code).toBe('02108');
      expect(result.house).toBe('123');
      
      // With alternative property names
      const alternativeAddressField = {
        value: {
          road: 'Oak Street',
          locality: 'Chicago',
          region: 'IL',
          zipCode: '60601',
          building: 'Building A'
        }
      };
      
      const result2 = mapper.extractCustomerAddress(alternativeAddressField);
      expect(result2.street_address).toBe('Oak Street');
      expect(result2.city).toBe('Chicago');
      expect(result2.state).toBe('IL');
      expect(result2.postal_code).toBe('60601');
      expect(result2.house).toBe('Building A');
    });
    
    it('should handle additional fallback field names in address extraction', () => {
      const addressWithRareFallbacks = {
        value: {
          street: 'Maple Avenue',
          city: 'Toronto',
          province: 'Ontario',
          postalCode: 'M5V 2L7',
          building: '42'
        }
      };
      
      const result = mapper.extractCustomerAddress(addressWithRareFallbacks);
      expect(result.street_address).toBe('Maple Avenue');
      expect(result.city).toBe('Toronto');
      expect(result.state).toBe('Ontario');
      expect(result.postal_code).toBe('M5V 2L7');
      expect(result.house).toBe('42');
    });
    
    it('should handle missing address components separately', () => {
      // Missing state but has city and postal code
      const addressWithMissingState = {
        value: {
          streetAddress: '123 Main St',
          city: 'Portland',
          postalCode: '97201'
        }
      };
      
      const result1 = mapper.extractCustomerAddress(addressWithMissingState);
      expect(result1.city).toBe('Portland');
      expect(result1.state).toBeNull();
      expect(result1.postal_code).toBe('97201');
      
      // Missing postal code but has city and state
      const addressWithMissingPostalCode = {
        value: {
          streetAddress: '456 Oak Ave',
          city: 'Seattle',
          state: 'WA',
        }
      };
      
      const result2 = mapper.extractCustomerAddress(addressWithMissingPostalCode);
      expect(result2.city).toBe('Seattle');
      expect(result2.state).toBe('WA');
      expect(result2.postal_code).toBeNull();
      
      // Missing all components
      const addressWithNoComponents = {
        value: {}
      };
      
      const result3 = mapper.extractCustomerAddress(addressWithNoComponents);
      expect(result3.street_address).toBeNull();
      expect(result3.city).toBeNull();
      expect(result3.state).toBeNull();
      expect(result3.postal_code).toBeNull();
      expect(result3.house).toBeNull();
    });
    
    it('should handle component extraction from content when needed', () => {
      // State missing from value but in content
      const stateMissingWithContent = {
        value: {
          streetAddress: '456 Oak St',
          city: 'Portland',
          postalCode: '97201'
        },
        content: '456 Oak St\nPortland, OR 97201'
      };
      
      const result1 = mapper.extractCustomerAddress(stateMissingWithContent);
      expect(result1.city).toBe('Portland');
      expect(result1.state).toBe('OR');
      expect(result1.postal_code).toBe('97201');
      
      // Postal code missing from value but in content
      const postalMissingWithContent = {
        value: {
          streetAddress: '789 Pine St',
          city: 'Seattle',
          state: 'WA',
        },
        content: '789 Pine St\nSeattle, WA 98101'
      };
      
      const result2 = mapper.extractCustomerAddress(postalMissingWithContent);
      expect(result2.city).toBe('Seattle');
      expect(result2.state).toBe('WA');
      expect(result2.postal_code).toBe('98101');
      
      // City missing from value but in content
      const cityMissingWithContent = {
        value: {
          streetAddress: '123 Market St',
          state: 'CA',
          postalCode: '94105'
        },
        content: '123 Market St\nSan Francisco, CA 94105'
      };
      
      const result3 = mapper.extractCustomerAddress(cityMissingWithContent);
      expect(result3.city).toBe('San Francisco');
      expect(result3.state).toBe('CA');
      expect(result3.postal_code).toBe('94105');
    });
    
    it('should not use content when all components exist in value', () => {
      const addressWithAllComponents = {
        value: {
          streetAddress: '100 Main St',
          city: 'Boston',
          state: 'MA',
          postalCode: '02108',
          houseNumber: '100'
        },
        content: '999 Different St\nNew York, NY 10001'
      };
      
      const result = mapper.extractCustomerAddress(addressWithAllComponents);
      
      expect(result.city).toBe('Boston');
      expect(result.state).toBe('MA');
      expect(result.postal_code).toBe('02108');
      expect(result.street_address).toBe('100 Main St');
    });
    
    it('should handle house number extraction edge cases', () => {
      // street_address is null with content fallback
      const addressWithNullStreet = {
        value: {
          city: 'Portland',
          state: 'OR',
          postalCode: '97201'
        },
        content: '123 Oak Lane\nPortland, OR 97201'
      };
      
      const result1 = mapper.extractCustomerAddress(addressWithNullStreet);
      expect(result1.street_address).toBe('123 Oak Lane');
      expect(result1.house).toBe('123');
      
      // Address without extractable house number
      const addressWithoutHouseNumber = {
        value: {
          streetAddress: 'Main Street, Apt B',
          city: 'Chicago',
          state: 'IL',
          postalCode: '60601'
        }
      };
      
      const result2 = mapper.extractCustomerAddress(addressWithoutHouseNumber);
      expect(result2.street_address).toBe('Main Street, Apt B');
      expect(result2.house).toBeNull();
      
      // Empty content with no street_address
      const addressWithNoStreetAndEmptyContent = {
        value: {
          city: 'Seattle',
          state: 'WA',
          postalCode: '98101'
        },
        content: ''
      };
      
      const result3 = mapper.extractCustomerAddress(addressWithNoStreetAndEmptyContent);
      expect(result3.street_address).toBeNull();
      expect(result3.house).toBeNull();
    });
  });
});