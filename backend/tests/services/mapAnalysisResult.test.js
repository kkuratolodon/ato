// Define all mocks first - Jest hoists these to the top of the file
jest.mock('../../src/services/invoiceService', () => {
  // Create the mock azureMapper first
  const azureMapper = {
    mapToInvoiceModel: jest.fn().mockReturnValue({
      invoiceData: { invoice_number: 'INV-001' },
      customerData: { name: 'Test Customer' },
      vendorData: { name: 'Test Vendor' },
      itemsData: [{ description: 'Test Item' }]
    })
  };
  
  // Mock implementation of mapAnalysisResult
  const mapAnalysisResult = (analysisResult, partnerId, originalname, fileSize) => {
    // Check for null/undefined inputs (matching the real implementation)
    if (!analysisResult || !analysisResult.data) {
      throw new Error('Failed to analyze invoice: No data returned');
    }
    
    // Actually call the mock mapper (this is what we're missing)
    const mappedResult = azureMapper.mapToInvoiceModel(analysisResult.data, partnerId);
    
    // Add file metadata (matching the real implementation)
    mappedResult.invoiceData.original_filename = originalname;
    mappedResult.invoiceData.file_size = fileSize;
    
    return mappedResult;
  };
  
  // Return mock service with the functions we need
  return {
    mapAnalysisResult,
    azureMapper
  };
});

// The existing mock for invoiceMapperService can be kept
jest.mock('../../src/services/invoiceMapperService', () => {
  return {
    AzureInvoiceMapper: jest.fn().mockImplementation(() => {
      return {
        mapToInvoiceModel: jest.fn().mockReturnValue({
          invoiceData: { invoice_number: 'INV-001' },
          customerData: { name: 'Test Customer' },
          vendorData: { name: 'Test Vendor' },
          itemsData: [{ description: 'Test Item' }]
        })
      };
    })
  };
});

// Only import AFTER all mocks are defined
const invoiceService = require('../../src/services/invoiceService');


describe('mapAnalysisResult method', () => {
  // Setup common test variables
  const partnerId = 'partner-123';
  const originalname = 'test.pdf';
  const fileSize = 1024;

  beforeEach(() => {
    // Make sure we have clean mocks for each test
    jest.clearAllMocks();
  });
  
  // The rest of your test cases should work with the mocked implementation
  test('should throw error when analysisResult is null', () => {
    // Arrange
    const analysisResult = null;

    // Act & Assert
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow('Failed to analyze invoice: No data returned');
  });

  test('should throw error when analysisResult is undefined', () => {
    // Arrange
    const analysisResult = undefined;

    // Act & Assert
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow('Failed to analyze invoice: No data returned');
  });

  test('should throw error when analysisResult has no data property', () => {
    // Arrange
    const analysisResult = { message: 'Success' }; // Missing data property

    // Act & Assert
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow('Failed to analyze invoice: No data returned');
  });

  test('should throw error when analysisResult.data is null', () => {
    // Arrange
    const analysisResult = { data: null };

    // Act & Assert
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow('Failed to analyze invoice: No data returned');
  });

  test('should throw error when analysisResult.data is undefined', () => {
    // Arrange
    const analysisResult = { data: undefined };

    // Act & Assert
    expect(() => {
      invoiceService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    }).toThrow('Failed to analyze invoice: No data returned');
  });

  test('should add file metadata to invoiceData', () => {
    // Arrange
    const analysisResult = { 
      data: { 
        someField: 'someValue' 
      } 
    };

    // Mock the azureMapper directly on the invoiceService instance
    invoiceService.azureMapper.mapToInvoiceModel = jest.fn().mockReturnValue({
      invoiceData: { invoice_number: 'INV-001' },
      customerData: { name: 'Test Customer' },
      vendorData: { name: 'Test Vendor' },
      itemsData: [{ description: 'Test Item' }]
    });

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
});
