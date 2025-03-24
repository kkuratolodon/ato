const { getMapper, partnerId } = require('./setupAzureInvoiceMapper');

describe('Date Processing', () => {
    it('should handle invalid date format with fallback to current date', () => {
      const mapper = getMapper();
      const invalidDate = { content: 'invalid-date' };
      
      const now = new Date();
      const result = mapper.parseDate(invalidDate);
      
      expect(result instanceof Date).toBe(true);
      const timeDiff = Math.abs(result.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
    
    it('should calculate due date based on payment terms', () => {
      const mapper = getMapper();
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
      const mapper = getMapper();
      const invoiceDate = new Date('2023-05-15');
      
      expect(mapper.calculateDueDate(invoiceDate, 'Net')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, 'n/a')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, 'Net 0')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, 'Net -10')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, '0')).toEqual(new Date('2023-06-14'));
      expect(mapper.calculateDueDate(invoiceDate, '-5')).toEqual(new Date('2023-06-14'));
    });

    it('should default to current date when date field exists but is empty', () => {
      const mapper = getMapper();
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