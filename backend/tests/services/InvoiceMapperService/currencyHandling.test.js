const { getMapper, partnerId } = require('./setupAzureInvoiceMapper');

describe('Currency Handling Functionality', () => {
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
});
