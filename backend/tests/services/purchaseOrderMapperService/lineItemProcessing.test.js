const { getMapper } = require('./setupAzurePurchaseOrderMapper');

describe('PO Line Item Processing', () => {
    it('should handle various line item formats', () => {
      const mapper = getMapper();
      // Standard format
      const standardItems = {
        values: [
          {
            properties: {
              Description: { content: 'Standard Item' },
              Quantity: { content: '2' },
              UnitPrice: { content: '10.00' },
              Amount: { content: '20.00' }
            }
          }
        ]
      };
      
      const result1 = mapper.EntityExtractor.extractLineItems(standardItems);
      expect(result1[0].description).toBe('Standard Item');
      expect(result1[0].quantity).toBe(2);
      expect(result1[0].unitPrice).toBe(10);
      expect(result1[0].amount).toBe(20);
      
      // Alternative field names
      const alternativeItems = {
        values: [
          {
            properties: {
              ProductCode: { content: 'Alternative field name' },
              Quantity: { content: '2' },
              UnitPrice: { content: '45.00' },
              Amount: { content: '90.00' }
            }
          }
        ]
      };
      
      const result2 = mapper.EntityExtractor.extractLineItems(alternativeItems);
      expect(result2[0].description).toBe('Alternative field name');
      expect(result2[0].quantity).toBe(2);
      expect(result2[0].unitPrice).toBe(45);
      expect(result2[0].amount).toBe(90);
      
      // Missing fields
      const partialItems = {
        values: [
          {
            properties: {
              Description: null,
              Quantity: { content: '3' },
              Amount: { content: '45.00' }
            }
          }
        ]
      };
      
      const result3 = mapper.EntityExtractor.extractLineItems(partialItems);
      expect(result3[0].description).toBeNull();
      expect(result3[0].quantity).toBe(3);
      expect(result3[0].unitPrice).toBeNull();
      expect(result3[0].amount).toBe(45);
      
      // Missing properties
      const itemsWithMissingproperties = {
        values: [{ someOtherProperty: 'test' }]
      };
      
      const result4 = mapper.EntityExtractor.extractLineItems(itemsWithMissingproperties);
      expect(result4).toHaveLength(1);
      expect(result4[0].description).toBeNull();
      expect(result4[0].quantity).toBeNull();
    });
    
    it('should handle non-structured line items', () => {
      const mapper = getMapper();
      const itemsWithContent = {
        content: 'Single line item description without structured data'
      };
      
      const result = mapper.EntityExtractor.extractLineItems(itemsWithContent);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Single line item description without structured data');
      expect(result[0].quantity).toBeNull();
      expect(result[0].unitPrice).toBeNull();
      expect(result[0].amount).toBeNull();
    });
    
    it('should return empty array when items field has no usable content', () => {
      const mapper = getMapper();
      const emptyContentItemsField = {
        content: '',
        someOtherProperty: 'value'
      };
      
      expect(mapper.EntityExtractor.extractLineItems(emptyContentItemsField)).toEqual([]);
      
      const nullContentItemsField = {
        someProperty: 'test',
        content: null
      };
      
      expect(mapper.EntityExtractor.extractLineItems(nullContentItemsField)).toEqual([]);
    });
});