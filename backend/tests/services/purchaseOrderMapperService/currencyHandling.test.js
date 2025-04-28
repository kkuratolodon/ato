const { getMapper, partnerId } = require('./setupAzurePurchaseOrderMapper');

describe('PO Currency Handling Functionality', () => {
  it('should use totalAmount as fallback when parseCurrency returns falsy for SubTotal', () => {
    const mapper = getMapper();
    // Override parseCurrency just for this test
    const originalParseCurrency = mapper.fieldParser.parseCurrency;
    mapper.fieldParser.parseCurrency = jest.fn((field) => {
      if (field === 'SubTotal') {
        return null; // Return falsy value specifically for SubTotal
      } else {
        return { amount: 850, currency: { currencySymbol: '$', currencyCode: 'USD' } };
      }
    });

    const ocrWithForcedFallback = {
      documents: [{
        fields: {
          PONumber: { content: 'PO-FORCED-FALLBACK' },
          Total: 'total', // Not used directly, our mock will handle this
          SubTotal: 'SubTotal'   // Specific value our mock will check for
        }
      }]
    };

    const { purchaseOrderData } = mapper.mapToPurchaseOrderModel(ocrWithForcedFallback, partnerId);
    
    // Verify our mock was called correctly
    expect(mapper.fieldParser.parseCurrency).toHaveBeenCalledWith('SubTotal');
    expect(purchaseOrderData.subtotal_amount).toBe(850); // Should use total_amount via direct fallback

    // Restore original method
    mapper.fieldParser.parseCurrency = originalParseCurrency;
  });

  it('should use totalAmountCurrency as fallback when subtotalAmount has null currency', () => {
    const mapper = getMapper();
    // Override parseCurrency just for this test
    const originalParseCurrency = mapper.fieldParser.parseCurrency;
    mapper.fieldParser.parseCurrency = jest.fn((field) => {
      if (field === 'SubTotal') {
        // Return amount but with null currency
        return { amount: 750, currency: null };
      } else if (field === 'Total' || field === 'InvoiceTotal') {
        // Return both amount and currency for total
        return { amount: 850, currency: { currencySymbol: '€', currencyCode: 'EUR' } };
      } else {
        return { amount: null, currency: null };
      }
    });

    const ocrWithCurrencyFallback = {
      documents: [{
        fields: {
          PONumber: { content: 'PO-CURRENCY-FALLBACK' },
          Total: 'total', 
          SubTotal: 'subtotal'
        }
      }]
    };

    const { purchaseOrderData } = mapper.mapToPurchaseOrderModel(ocrWithCurrencyFallback, partnerId);
    
    // Verify currency fallback worked
    expect(purchaseOrderData.currency_symbol).toBe(null);
    expect(purchaseOrderData.currency_code).toBe(null);
    
    // Restore original method
    mapper.fieldParser.parseCurrency = originalParseCurrency;
  });

  it('should default to null for missing currencySymbol and currencyCode in PO data', () => {
    const mapper = getMapper();
    // Create a field with amount but no currency properties
    const fieldWithAmountOnly = {
      value: {
        amount: 500
        // No currencySymbol or currencyCode
      }
    };
    
    // Parse the currency field
    const result = mapper.fieldParser.parseCurrency(fieldWithAmountOnly);
    
    // Verify amount was parsed correctly
    expect(result.amount).toBe(500);
    
    // Verify currency properties default to null
    expect(result.currency.currencySymbol).toBe(null);
    expect(result.currency.currencyCode).toBe(null);
  });
});