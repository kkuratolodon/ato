const { getMapper } = require('./setupAzureInvoiceMapper');

describe('Address Processing', () => {
  let mapper;
  
  beforeEach(() => {
    mapper = getMapper();
  });

  describe('Customer Address Processing', () => {
    const customerAddressTestCases = [
      {
        name: 'City, STATE ZIP pattern',
        input: {
          CustomerAddress: { content: '123 Main St\nAustin, TX 78701' },
          CustomerName: { content: 'Test Customer' }
        },
        expected: {
          address: '123 Main St Austin, TX 78701',
          name: 'Test Customer'
        }
      },
      {
        name: 'City STATE ZIP pattern (no comma)',
        input: {
          CustomerAddress: { content: '456 Oak Ave\nSeattle WA 98101' },
          CustomerName: { content: 'Test Customer 2' }
        },
        expected: {
          address: '456 Oak Ave Seattle WA 98101',
          name: 'Test Customer 2'
        }
      },
      {
        name: 'International format',
        input: {
          CustomerAddress: { content: '789 High Street\nLondon, England EC1A 1BB' },
          CustomerName: { content: 'Test Customer 3' }
        },
        expected: {
          address: '789 High Street London, England EC1A 1BB',
          name: 'Test Customer 3'
        }
      },
      {
        name: 'structured address data in BillingAddress',
        input: {
          BillingAddress: {
            value: { text: '123 Main Avenue\nBoston, MA 02108' }
          },
          BillingAddressRecipient: { content: 'John Doe' }
        },
        expected: {
          address: '123 Main Avenue Boston, MA 02108',
          name: 'John Doe'
        }
      },
      {
        name: 'missing address components',
        input: {
          CustomerName: { content: 'Test Customer' }
        },
        expected: {
          address: null,
          name: 'Test Customer'
        }
      }
    ];

    customerAddressTestCases.forEach(({ name, input, expected }) => {
      it(`should handle ${name}`, () => {
        const result = mapper.extractCustomerData(input);
        expect(result.address).toBe(expected.address);
        if (expected.name) {
          expect(result.name).toBe(expected.name);
        }
      });
    });


    it('should handle null or undefined address values', () => {
      const fields1 = {
        CustomerAddress: { content: null },
        CustomerName: { content: 'Test Customer' }
      };
      
      const result1 = mapper.extractCustomerData(fields1);
      expect(result1.address).toBeNull();
      
      const fields2 = {
        CustomerAddress: { content: undefined },
        CustomerName: { content: 'Test Customer' }
      };
      
      const result2 = mapper.extractCustomerData(fields2);
      expect(result2.address).toBeNull();
    });
  });

  describe('Vendor Address Processing', () => {
    it('should handle vendor address data', () => {
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

    it('should handle invalid vendor address data', () => {
      const fields = {
        VendorAddress: { content: '' },
        VendorName: { content: 'Test Vendor' }
      };
      
      const result = mapper.extractVendorData(fields);
      expect(result.address).toBe("")
      expect(result.name).toBe('Test Vendor');
    });
  });
});