const { getMapper } = require('./setupAzureInvoiceMapper');

describe('Partner ID Generation', () => {
    it('should generate valid partner IDs from vendor names', () => {
      const mapper = getMapper();
      expect(mapper.generatePartnerId('Acme Corp Ltd.')).toBe('acme-corp-ltd');
      expect(mapper.generatePartnerId('   Spaces   ')).toBe('spaces');
      expect(mapper.generatePartnerId('')).toBe('unknown-vendor');
      expect(mapper.generatePartnerId(null)).toBe('unknown-vendor');
      
      // Test truncation for long names
      const longName = 'Really Long Company Name That Should Be Truncated To Fit Database Fields';
      expect(mapper.generatePartnerId(longName).length).toBeLessThanOrEqual(44);
    });
  });