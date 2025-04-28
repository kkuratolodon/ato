const { getMapper, partnerId } = require('./setupAzurePurchaseOrderMapper');

describe('PO Date Processing', () => {
    it('should handle invalid date format with fallback to current date', () => {
      const mapper = getMapper();
      const invalidDate = { content: 'invalid-date' };
      
      const now = new Date();
      const result = mapper.fieldParser.parseDate(invalidDate);
      
      expect(result instanceof Date).toBe(true);
      const timeDiff = Math.abs(result.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
    
    it('should default to current date when date field exists but is empty', () => {
      const mapper = getMapper();
      const ocrWithEmptyDate = {
        documents: [{
          fields: {
            PODate: { content: '' },
            Total: { content: '$100.00' }
          }
        }]
      };
      
      const now = new Date();
      const { purchaseOrderData } = mapper.mapToPurchaseOrderModel(ocrWithEmptyDate, partnerId);
      
      const timeDiff = Math.abs(purchaseOrderData.due_date.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(1000);
    });
    
    it('should handle various date formats in PO documents', () => {
      const mapper = getMapper();
      
      // Test with different date field names
      const formats = [
        { PODate: { content: '15/05/2023' } },
        { InvoiceDate: { content: '05/15/2023' } }, // Since PO mapper falls back to InvoiceDate if PODate is missing
        { PODate: { content: '2023-05-15' } }
      ];
      
      formats.forEach(dateField => {
        const ocr = {
          documents: [{
            fields: {
              ...dateField,
              PONumber: { content: 'TEST-PO-DATE' }
            }
          }]
        };
        
        const { purchaseOrderData } = mapper.mapToPurchaseOrderModel(ocr, partnerId);
        
        // All should be parsed as the same date regardless of format
        expect(purchaseOrderData.due_date.getFullYear()).toBe(2023);
        expect(purchaseOrderData.due_date.getMonth()).toBe(4); // May is 4 (zero-indexed)
        expect(purchaseOrderData.due_date.getDate()).toBe(15);
      });
    });
});