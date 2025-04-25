const purchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');
const Sentry = require("../../../src/instrument");

// Mock repositories
jest.mock('../../../src/repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    update: jest.fn().mockResolvedValue([1]),
    updateStatus: jest.fn().mockResolvedValue([1]),
    findById: jest.fn().mockResolvedValue({})
  }));
});

// Mock dependencies
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/instrument', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

describe('Purchase Order Service - Store Analysis JSON URL', () => {
  const mockPOId = 'po-123';
  const mockBuffer = Buffer.from('test PDF content');
  const mockJsonUrl = 'https://example.com/analysis/po-analysis.json';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock analyzePurchaseOrder to return a mock result
    purchaseOrderService.analyzePurchaseOrder = jest.fn().mockResolvedValue({
      data: {
        fields: {
          purchaseOrderNumber: { text: 'PO-001' },
          total: { text: '100.00' }
        }
      }
    });
    
    // Mock uploadAnalysisResults to return a mock URL
    purchaseOrderService.uploadAnalysisResults = jest.fn().mockResolvedValue(mockJsonUrl);
    
    // Mock console methods to avoid cluttering test output
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });
  
  /***************
   * POSITIVE CASES
   ***************/

  test('[POSITIVE] should store analysis_json_url in the database', async () => {
    // Call the method that processes the purchase order
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Verify that analyzePurchaseOrder was called with the buffer
    expect(purchaseOrderService.analyzePurchaseOrder).toHaveBeenCalledWith(mockBuffer);
    
    // Verify that uploadAnalysisResults was called with the analysis result and purchase order ID
    expect(purchaseOrderService.uploadAnalysisResults).toHaveBeenCalled();
    
    // Verify that the repository update method was called with the purchase order ID and analysis_json_url
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      mockPOId,
      {
        analysis_json_url: mockJsonUrl
      }
    );
    
    // Verify that the status was updated to ANALYZED
    expect(purchaseOrderService.purchaseOrderRepository.updateStatus).toHaveBeenCalledWith(
      mockPOId, 
      DocumentStatus.ANALYZED
    );
  });
  
  test('[POSITIVE] should log successful processing with Sentry', async () => {
    // Call the method that processes the purchase order
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Verify that successful processing was logged via Sentry
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      `Successfully completed processing purchase order ${mockPOId}`
    );
    
    // Verify that console logging occurred
    expect(global.console.log).toHaveBeenCalledWith(
      `Analysis JSON URL for purchase order ${mockPOId}: ${mockJsonUrl}`
    );
  });

  /***************
   * NEGATIVE CASES
   ***************/

  test('[NEGATIVE] should handle error and not store URL when analysis fails', async () => {
    // Mock analyzePurchaseOrder to throw an error
    const mockError = new Error('Analysis failed');
    purchaseOrderService.analyzePurchaseOrder = jest.fn().mockRejectedValue(mockError);
    
    // Call the method that processes the purchase order
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Verify that update was not called with analysis_json_url
    expect(purchaseOrderService.purchaseOrderRepository.update).not.toHaveBeenCalled();
    
    // Verify that the status was updated to FAILED
    expect(purchaseOrderService.purchaseOrderRepository.updateStatus).toHaveBeenCalledWith(
      mockPOId, 
      DocumentStatus.FAILED
    );
    
    // Verify that the error was properly captured
    expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
    expect(global.console.error).toHaveBeenCalled();
    expect(global.console.error.mock.calls[0][0]).toBe(`Error in async processing for purchase order ${mockPOId}:`);
  });

  test('[NEGATIVE] should handle error when S3 upload fails', async () => {
    // Mock uploadAnalysisResults to throw an error
    const mockS3Error = new Error('S3 upload failed');
    purchaseOrderService.uploadAnalysisResults = jest.fn().mockRejectedValue(mockS3Error);
    
    // Call the method that processes the purchase order
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Verify that update was not called with analysis_json_url
    expect(purchaseOrderService.purchaseOrderRepository.update).not.toHaveBeenCalled();
    
    // Verify that the status was updated to FAILED
    expect(purchaseOrderService.purchaseOrderRepository.updateStatus).toHaveBeenCalledWith(
      mockPOId, 
      DocumentStatus.FAILED
    );
    
    // Verify error was captured in Sentry
    expect(Sentry.captureException).toHaveBeenCalledWith(mockS3Error);
  });

  /***************
   * CORNER CASES
   ***************/

  test('[CORNER] should handle empty analysis result but still store URL', async () => {
    // Mock analyzePurchaseOrder to return minimal valid data
    purchaseOrderService.analyzePurchaseOrder = jest.fn().mockResolvedValue({ data: {} });
    
    // Call the method that processes the purchase order
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Verify that update was still called with analysis_json_url
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      mockPOId,
      {
        analysis_json_url: mockJsonUrl
      }
    );
    
    // Process should still complete successfully
    expect(purchaseOrderService.purchaseOrderRepository.updateStatus).toHaveBeenCalledWith(
      mockPOId,
      DocumentStatus.ANALYZED
    );
  });

  test('[CORNER] should handle very large analysis result', async () => {
    // Create a large mock analysis result (would be large JSON in real scenario)
    const largeResult = {
      data: {
        fields: {},
        pages: Array(100).fill(0).map((_, i) => ({
          pageNumber: i,
          tables: Array(20).fill(0).map(() => ({
            cells: Array(50).fill(0).map(() => ({
              text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
            }))
          }))
        }))
      }
    };
    
    // Mock analyzePurchaseOrder to return the large result
    purchaseOrderService.analyzePurchaseOrder = jest.fn().mockResolvedValue(largeResult);
    
    // Call the method that processes the purchase order
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Verify that uploadAnalysisResults was called with the large result
    expect(purchaseOrderService.uploadAnalysisResults).toHaveBeenCalledWith(largeResult, mockPOId);
    
    // Verify that update was still called with analysis_json_url
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      mockPOId,
      {
        analysis_json_url: mockJsonUrl
      }
    );
  });
});