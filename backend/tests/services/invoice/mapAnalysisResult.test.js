const invoiceService = require('../../../src/services/invoice/invoiceService');
const { AzureInvoiceMapper } = require('../../../src/services/invoiceMapperService');


// Mock the invoiceMapperService
jest.mock('../../../src/services/invoiceMapperService', () => {
  return {
    AzureInvoiceMapper: jest.fn().mockImplementation(() => {
      return {
        mapToInvoiceModel: jest.fn((data, partnerId) => {
          // This mock implementation should match the behavior of the real implementation
          // For invalid inputs, we should throw the same errors that the real implementation would
          if (!data) {
            throw new TypeError("Cannot read properties of " + (data === null ? "null" : "undefined") + " (reading 'someProperty')");
          }
          
          // Return a valid mapping result for valid inputs - now using partnerId
          return {
            invoiceData: { 
              invoice_number: 'INV-001',
              partner_id: partnerId // Add partnerId to the response
            },
            customerData: { name: 'Test Customer' },
            vendorData: { name: 'Test Vendor' },
            itemsData: [{ description: 'Test Item' }]
          };
        })
      };
    })
  };
});

// Rest of the file remains the same

// Spy on console.log to prevent output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});

describe('mapAnalysisResult method', () => {
  // Setup common test variables
  const partnerId = 'partner-123';
  const originalname = 'test.pdf';
  const fileSize = 1024;

  beforeEach(() => {
    // Clear mocks between tests
    jest.clearAllMocks();
    
    // Ensure we're using our mocked mapper
    invoiceService.azureMapper = new AzureInvoiceMapper();
  });

  afterAll(() => {
    // Restore console.log
    console.log.mockRestore();
  });

  test('should throw TypeError when analysisResult is null', () => {
    // Arrange
    const analysisResult = null;

    // Act & Assert
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow(TypeError); // It will throw TypeError when accessing .data property on null
  });

  test('should throw TypeError when analysisResult is undefined', () => {
    // Arrange
    const analysisResult = undefined;

    // Act & Assert
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow(TypeError); // It will throw TypeError when accessing .data property on undefined
  });

  test('should throw TypeError when analysisResult has no data property', () => {
    // Arrange
    const analysisResult = { message: 'Success but no data' };
    
    // Act & Assert
    // Need to make the mock throw for this case specifically
    invoiceService.azureMapper.mapToInvoiceModel.mockImplementationOnce(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'someProperty')");
    });
    
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow(TypeError);
  });

  test('should throw TypeError when analysisResult.data is null', () => {
    // Arrange
    const analysisResult = { data: null };
    
    // Act & Assert
    // Need to make the mock throw for this case specifically
    invoiceService.azureMapper.mapToInvoiceModel.mockImplementationOnce(() => {
      throw new TypeError("Cannot read properties of null (reading 'someProperty')");
    });
    
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow(TypeError);
  });

  test('should throw TypeError when analysisResult.data is undefined', () => {
    // Arrange
    const analysisResult = { data: undefined };
    
    // Act & Assert
    // Need to make the mock throw for this case specifically
    invoiceService.azureMapper.mapToInvoiceModel.mockImplementationOnce(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'someProperty')");
    });
    
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow(TypeError);
  });

  test('should add file metadata to invoiceData', () => {
    // Arrange
    const analysisResult = { 
      data: { 
        someField: 'someValue' 
      } 
    };

    // Act
    const result = invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);

    // Assert
    expect(invoiceService.azureMapper.mapToInvoiceModel).toHaveBeenCalledWith(
      analysisResult.data,
      partnerId
    );
    expect(result.invoiceData.original_filename).toBe(originalname);
    expect(result.invoiceData.file_size).toBe(fileSize);
  });

  test('should return object with expected structure', () => {
    // Arrange
    const analysisResult = { data: { someField: 'someValue' } };
    const expectedStructure = {
      invoiceData: expect.any(Object),
      customerData: expect.any(Object),
      vendorData: expect.any(Object),
      itemsData: expect.any(Array)
    };

    // Act
    const result = invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);

    // Assert
    expect(result).toMatchObject(expectedStructure);
  });

  test('should log mapped invoice data', () => {
    // Arrange
    const analysisResult = { data: { someField: 'someValue' } };

    // Act
    invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);

    // Assert
    expect(console.log).toHaveBeenCalledWith(
      "Invoice data mapped:",
      expect.any(String)
    );
  });

  test('should handle custom data returned by mapper', () => {
    // Arrange
    const analysisResult = { data: { someField: 'someValue' } };
    const customMapperResult = {
      invoiceData: { 
        invoice_number: 'CUSTOM-INV',
        custom_field: 'custom value'
      },
      customerData: { name: 'Custom Customer' },
      vendorData: { name: 'Custom Vendor' },
      itemsData: [{ description: 'Custom Item' }]
    };
    
    // Override mock for this test only
    invoiceService.azureMapper.mapToInvoiceModel.mockReturnValueOnce(customMapperResult);

    // Act
    const result = invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);

    // Assert
    expect(result.invoiceData.invoice_number).toBe('CUSTOM-INV');
    expect(result.invoiceData.custom_field).toBe('custom value');
    expect(result.customerData.name).toBe('Custom Customer');
  });
});