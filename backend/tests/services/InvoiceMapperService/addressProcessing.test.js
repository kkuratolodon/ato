const { getMapper } = require('./setupAzureInvoiceMapper');

describe('Address Processing', () => {
    it('should handle different address patterns for customer address extraction', () => {
      const mapper = getMapper();
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
      const mapper = getMapper();
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
      const mapper = getMapper();
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
      const mapper = getMapper();
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
      const mapper = getMapper();
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
      const mapper = getMapper();
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
      const mapper = getMapper();
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