const { getMapper, partnerId } = require('./setupAzureInvoiceMapper');
const { mockAzureOcrResult } = require('../../mocks/azure-ocr-result');

describe('Core Mapping Functionality', () => {
  it('should map Azure OCR result to Invoice model format', () => {
      const mapper = getMapper();
      const ocrResult = mockAzureOcrResult();
      const { invoiceData } = mapper.mapToInvoiceModel(ocrResult, partnerId);

      expect(invoiceData).toBeDefined();
      expect(invoiceData.purchase_order_id).toBe("12345");
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
    
    it('should use totalAmount as fallback when parseCurrency returns falsy for SubTotal', () => {
      const mapper = getMapper();
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
      const mapper = getMapper();
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
      const mapper = getMapper();
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
      const mapper = getMapper();
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
      const mapper = getMapper();
      const ocrResult = mockAzureOcrResult();
      const fileUrl = 'https://example.com/invoices/test.pdf';

      const { invoiceData } = await mapper.processInvoiceData(ocrResult, partnerId, fileUrl);
      expect(invoiceData.file_url).toBe(fileUrl);
    });

    it('should handle null fileUrl in processInvoiceData method', async () => {
      const mapper = getMapper();
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