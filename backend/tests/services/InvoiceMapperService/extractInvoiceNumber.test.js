const { getMapper } = require('./setupAzureInvoiceMapper');

describe('extractInvoiceNumber', () => {
    test('should extract from InvoiceId field when available', () => {
      const mapper = getMapper();
      // Arrange
      const fields = {
        InvoiceId: { value: 'INV-12345' },
        InvoiceNumber: { value: 'Should not use this' },
      };

      // Act
      const result = mapper.extractInvoiceNumber(fields);

      // Assert
      expect(result).toBe('INV-12345');
    });

    test('should extract from InvoiceNumber when InvoiceId is not available', () => {
      const mapper = getMapper();
      // Arrange
      const fields = {
        InvoiceNumber: { value: 'INV-12345' }
      };

      // Act
      const result = mapper.extractInvoiceNumber(fields);

      // Assert
      expect(result).toBe('INV-12345');
    });

    test('should extract from "Invoice number" when other fields are not available', () => {
      const mapper = getMapper();
      // Arrange
      const fields = {
        "Invoice number": { value: 'INV-12345' }
      };

      // Act
      const result = mapper.extractInvoiceNumber(fields);

      // Assert
      expect(result).toBe('INV-12345');
    });

    test('should extract from "Invoice #" when other fields are not available', () => {
      const mapper = getMapper();
      // Arrange
      const fields = {
        "Invoice #": { value: 'INV-12345' }
      };

      // Act
      const result = mapper.extractInvoiceNumber(fields);

      // Assert
      expect(result).toBe('INV-12345');
    });

    test('should extract from "Invoice No" when other fields are not available', () => {
      const mapper = getMapper();
      // Arrange
      const fields = {
        "Invoice No": { value: 'INV-12345' }
      };

      // Act
      const result = mapper.extractInvoiceNumber(fields);

      // Assert
      expect(result).toBe('INV-12345');
    });

    test('should extract from "Invoice No." when other fields are not available', () => {
      const mapper = getMapper();
      // Arrange
      const fields = {
        "Invoice No.": { value: 'INV-12345' }
      };

      // Act
      const result = mapper.extractInvoiceNumber(fields);

      // Assert
      expect(result).toBe('INV-12345');
    });

    test('should return empty string when no invoice number field is available', () => {
      const mapper = getMapper();
      // Arrange
      const fields = {
        SomeOtherField: { value: 'Not an invoice number' }
      };

      // Act
      const result = mapper.extractInvoiceNumber(fields);

      // Assert
      expect(result).toBe('');
    });

    test('should return empty string when fields is null or undefined', () => {
      const mapper = getMapper();
      // Arrange - Null case
      const nullFields = null;

      // Act
      const nullResult = mapper.extractInvoiceNumber(nullFields);

      // Assert
      expect(nullResult).toBe('');

      // Arrange - Undefined case
      const undefinedFields = undefined;

      // Act
      const undefinedResult = mapper.extractInvoiceNumber(undefinedFields);

      // Assert
      expect(undefinedResult).toBe('');
    });

    test('should handle different value formats from OCR', () => {
      const mapper = getMapper();
      // Arrange - Field with content property
      const fieldsWithContent = {
        InvoiceId: { content: 'INV-12345' }
      };

      // Arrange - Field with nested text value
      const fieldsWithNestedValue = {
        InvoiceId: { value: { text: 'INV-67890' } }
      };

      // Act
      const contentResult = mapper.extractInvoiceNumber(fieldsWithContent);
      const nestedResult = mapper.extractInvoiceNumber(fieldsWithNestedValue);

      // Assert
      expect(contentResult).toBe('INV-12345');
      expect(nestedResult).toBe('INV-67890');
    });

    test('should trim whitespace from extracted value', () => {
      const mapper = getMapper();
      // Arrange
      const fields = {
        InvoiceId: { value: '  INV-12345  ' }
      };

      // Act
      const result = mapper.extractInvoiceNumber(fields);

      // Assert
      expect(result).toBe('INV-12345');
    });
  });