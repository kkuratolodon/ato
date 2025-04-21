const purchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');
const { AzurePurchaseOrderMapper } = require('../../../src/services/purchaseOrderMapperService/purchaseOrderMapperService');


// Mock the purchaseOrderMapperService
jest.mock('../../../src/services/purchaseOrderMapperService/purchaseOrderMapperService', () => {
  return {
    AzurePurchaseOrderMapper: jest.fn().mockImplementation(() => {
      return {
        mapToPurchaseOrderModel: jest.fn((data, partnerId) => {
          // This mock implementation should match the behavior of the real implementation
          // For invalid inputs, we should throw the same errors that the real implementation would
          if (!data) {
            throw new TypeError("Cannot read properties of " + (data === null ? "null" : "undefined") + " (reading 'someProperty')");
          }
          
          // Return a valid mapping result for valid inputs - now using partnerId
          return {
            purchaseOrderData: { 
              purchase_order_number: 'PO-001',
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

// Spy on console.log to prevent output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});

describe('mapAnalysisResult method for Purchase Orders', () => {
  // Setup common test variables
  const partnerId = 'partner-123';
  const originalname = 'test.pdf';
  const fileSize = 1024;

  beforeEach(() => {
    // Clear mocks between tests
    jest.clearAllMocks();
    
    // Ensure we're using our mocked mapper
    purchaseOrderService.azureMapper = new AzurePurchaseOrderMapper();
  });

  afterAll(() => {
    // Restore console.log
    console.log.mockRestore();
  });

  test('should throw TypeError when analysisResult is null', () => {
    expect(() => {
      purchaseOrderService.mapAnalysisResult(null, partnerId, originalname, fileSize);
    }).toThrow(TypeError);
  });

  test('should throw TypeError when analysisResult is undefined', () => {
    expect(() => {
      purchaseOrderService.mapAnalysisResult(undefined, partnerId, originalname, fileSize);
    }).toThrow(TypeError);
  });

  test('should call azureMapper.mapToPurchaseOrderModel with correct params', () => {
    // Arrange
    const analysisResult = { data: { someProperty: 'value' } };
    
    // Assert
    expect(purchaseOrderService.azureMapper.mapToPurchaseOrderModel).toHaveBeenCalledWith(
      analysisResult.data, partnerId
    );
  });

  test('should add original_filename and file_size to purchaseOrderData', () => {
    // Arrange
    const analysisResult = { data: { someProperty: 'value' } };
    
    // Act
    const result = purchaseOrderService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    
    // Assert
    expect(result.purchaseOrderData.original_filename).toBe(originalname);
    expect(result.purchaseOrderData.file_size).toBe(fileSize);
  });

  test('should return the expected structure', () => {
    // Arrange
    const analysisResult = { data: { someProperty: 'value' } };
    
    // Act
    const result = purchaseOrderService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    
    // Assert
    expect(result).toHaveProperty('purchaseOrderData');
    expect(result).toHaveProperty('customerData');
    expect(result).toHaveProperty('vendorData');
    expect(result).toHaveProperty('itemsData');
    
    // Check specific values
    expect(result.purchaseOrderData.purchase_order_number).toBe('PO-001');
    expect(result.purchaseOrderData.partner_id).toBe(partnerId);
    expect(result.purchaseOrderData.original_filename).toBe(originalname);
    expect(result.purchaseOrderData.file_size).toBe(fileSize);
    
    expect(result.customerData.name).toBe('Test Customer');
    expect(result.vendorData.name).toBe('Test Vendor');
    expect(Array.isArray(result.itemsData)).toBe(true);
    expect(result.itemsData[0].description).toBe('Test Item');
  });

  test('should log mapped purchase order data', () => {
    // Arrange
    const analysisResult = { data: { someProperty: 'value' } };
    
    // Act
    purchaseOrderService.mapAnalysisResult(analysisResult, partnerId, originalname, fileSize);
    
    // Assert
    expect(console.log).toHaveBeenCalledWith(
      "Purchase order data mapped:", 
      expect.any(String) // The stringified JSON
    );
  });
});