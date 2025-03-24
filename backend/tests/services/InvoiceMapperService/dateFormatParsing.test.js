const { AzureInvoiceMapper } = require('../../../src/services/invoiceMapperService');

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