const purchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');

// Mock AzureDocumentAnalyzer
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer', () => {
  return jest.fn().mockImplementation(() => {
    return {
      analyzeDocument: jest.fn()
    };
  });
});

// Mock other dependencies
jest.mock('../../../src/repositories/purchaseOrderRepository');
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');
jest.mock('../../../src/services/purchaseOrder/purchaseOrderValidator');
jest.mock('../../../src/services/purchaseOrder/purchaseOrderResponseFormatter');
jest.mock('../../../src/services/purchaseOrderMapperService/purchaseOrderMapperService');

describe('analyzePurchaseOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup the mock implementation
    purchaseOrderService.documentAnalyzer.analyzeDocument.mockResolvedValue({
      data: {
        analyzeResult: {
          documentResults: [
            {
              fields: {
                PurchaseOrderNumber: { text: 'PO-12345' },
                PurchaseOrderDate: { text: '2025-04-15' }
              }
            }
          ]
        }
      }
    });
  });

  test('should call AzureDocumentAnalyzer with correct parameters', async () => {
    // Arrange
    const documentBuffer = Buffer.from('test document content');
    
    // Act
    const result = await purchaseOrderService.analyzePurchaseOrder(documentBuffer);
    
    // Assert
    expect(purchaseOrderService.documentAnalyzer.analyzeDocument).toHaveBeenCalledWith(documentBuffer);
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('analyzeResult');
  });

  test('should pass through document URL when string is provided', async () => {
    // Arrange
    const documentUrl = 'https://example.com/document.pdf';
    
    // Act
    await purchaseOrderService.analyzePurchaseOrder(documentUrl);
    
    // Assert
    expect(purchaseOrderService.documentAnalyzer.analyzeDocument).toHaveBeenCalledWith(documentUrl);
  });

  test('should handle and propagate analysis errors', async () => {
    // Arrange
    const documentBuffer = Buffer.from('test document content');
    const error = new Error('Analysis service unavailable');
    
    purchaseOrderService.documentAnalyzer.analyzeDocument.mockRejectedValue(error);
    
    // Act & Assert
    await expect(purchaseOrderService.analyzePurchaseOrder(documentBuffer))
      .rejects.toThrow('Analysis service unavailable');
  });

  test('should handle null document', async () => {
    // Arrange
    const documentBuffer = null;
    const error = new TypeError('Cannot analyze null document');
    
    purchaseOrderService.documentAnalyzer.analyzeDocument.mockRejectedValue(error);
    
    // Act & Assert
    await expect(purchaseOrderService.analyzePurchaseOrder(documentBuffer))
      .rejects.toThrow('Cannot analyze null document');
  });
});