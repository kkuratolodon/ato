const { getMapper } = require('./setupAzureInvoiceMapper');

describe('Address Processing', () => {
    it('should handle different address patterns in customer data extraction', () => {
      const mapper = getMapper();
      
      // City, STATE ZIP pattern
      const fields = {
        CustomerAddress: {
          content: '123 Main St\nAustin, TX 78701'
        },
        CustomerName: { content: 'Test Customer' }
      };
      
      const result1 = mapper.extractCustomerData(fields);
      expect(result1.address).toBe('123 Main St Austin, TX 78701');
      expect(result1.name).toBe('Test Customer');
      
      // City STATE ZIP pattern (no comma)
      const fields2 = {
        CustomerAddress: {
          content: '456 Oak Ave\nSeattle WA 98101'
        },
        CustomerName: { content: 'Test Customer 2' }
      };
      
      const result2 = mapper.extractCustomerData(fields2);
      expect(result2.address).toBe('456 Oak Ave Seattle WA 98101');
      
      // International format
      const fields3 = {
        CustomerAddress: {
          content: '789 High Street\nLondon, England EC1A 1BB'
        },
        CustomerName: { content: 'Test Customer 3' }
      };
      
      const result3 = mapper.extractCustomerData(fields3);
      expect(result3.address).toBe('789 High Street London, England EC1A 1BB');
    });
    
    it('should handle structured address data in customer fields', () => {
      const mapper = getMapper();
      
      const fields = {
        BillingAddress: {
          value: {
            text: '123 Main Avenue\nBoston, MA 02108'
          }
        },
        BillingAddressRecipient: { content: 'John Doe' }
      };
      
      const result = mapper.extractCustomerData(fields);
      expect(result.address).toBe('123 Main Avenue Boston, MA 02108');
    });
    
    it('should handle missing address components', () => {
      const mapper = getMapper();
      
      const fields = {
        CustomerName: { content: 'Test Customer' }
        // No address provided
      };
      
      const result = mapper.extractCustomerData(fields);
      expect(result.address).toBeNull();
      expect(result.name).toBe('Test Customer');
    });

    it('should handle vendor address data', () => {
      const mapper = getMapper();
      
      const fields = {
        VendorAddress: {
          content: '123 Business St\nChicago, IL 60601'
        },
        VendorName: { content: 'Test Vendor' },
        VendorTaxId: { content: '123-45-6789' }
      };
      
      const result = mapper.extractVendorData(fields);
      expect(result.address).toBe('123 Business St Chicago, IL 60601');
      expect(result.name).toBe('Test Vendor');
      expect(result.tax_id).toBe('123-45-6789');
    });
});