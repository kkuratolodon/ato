const purchaseOrderService = require('@services/purchaseOrder/purchaseOrderService');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');
const Sentry = require("../../../src/instrument");

// Mock repositories
jest.mock('@repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    update: jest.fn().mockResolvedValue([1]),
    updateStatus: jest.fn().mockResolvedValue([1]),
    findById: jest.fn().mockResolvedValue({})
  }));
});

// Mock dependencies
jest.mock('@services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/instrument', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

describe('Purchase Order Service - Store Analysis JSON URL (Additional Tests)', () => {
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
    
    // Mock methods needed for mapping
    purchaseOrderService.mapAnalysisResult = jest.fn().mockReturnValue({
      purchaseOrderData: { purchase_order_number: 'PO-001' },
      customerData: { name: 'Test Customer' },
      vendorData: { name: 'Test Vendor' },
      itemsData: []
    });
    
    purchaseOrderService.updatePurchaseOrderRecord = jest.fn().mockResolvedValue();
    purchaseOrderService.updateCustomerAndVendorData = jest.fn().mockResolvedValue();
    purchaseOrderService.savePurchaseOrderItems = jest.fn().mockResolvedValue();
    
    // Mock console methods to avoid cluttering test output
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });
  
  test('should update status to FAILED when mapping analysis result fails', async () => {
    // Arrange
    const error = new Error('Mapping error');
    purchaseOrderService.mapAnalysisResult.mockImplementation(() => {
      throw error;
    });
    
    // Act
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Assert
    expect(purchaseOrderService.analyzePurchaseOrder).toHaveBeenCalled();
    expect(purchaseOrderService.mapAnalysisResult).toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      mockPOId,
      { status: DocumentStatus.FAILED }
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
  
  test('should update status to FAILED when updatePurchaseOrderRecord fails', async () => {
    // Arrange
    const error = new Error('Record update failed');
    purchaseOrderService.updatePurchaseOrderRecord.mockRejectedValue(error);
    
    // Act
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Assert
    expect(purchaseOrderService.analyzePurchaseOrder).toHaveBeenCalled();
    expect(purchaseOrderService.mapAnalysisResult).toHaveBeenCalled();
    expect(purchaseOrderService.updatePurchaseOrderRecord).toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      mockPOId,
      { status: DocumentStatus.FAILED }
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
  
  test('should handle null buffer gracefully', async () => {
    // Act
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, null);
    
    // Assert
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      mockPOId,
      { status: DocumentStatus.FAILED }
    );
    expect(Sentry.captureException).toHaveBeenCalled();
  });
  
  test('should handle undefined buffer gracefully', async () => {
    // Act
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, undefined);
    
    // Assert
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      mockPOId,
      { status: DocumentStatus.FAILED }
    );
    expect(Sentry.captureException).toHaveBeenCalled();
  });
  
  test('should handle errors during customer and vendor data update', async () => {
    // Arrange
    const error = new Error('Customer/vendor data update failed');
    purchaseOrderService.updateCustomerAndVendorData.mockRejectedValue(error);
    
    // Act
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Assert
    expect(purchaseOrderService.analyzePurchaseOrder).toHaveBeenCalled();
    expect(purchaseOrderService.mapAnalysisResult).toHaveBeenCalled();
    expect(purchaseOrderService.updatePurchaseOrderRecord).toHaveBeenCalled();
    expect(purchaseOrderService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      mockPOId,
      { status: DocumentStatus.FAILED }
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
  
  test('should handle errors during items data save', async () => {
    // Arrange
    const error = new Error('Items data save failed');
    purchaseOrderService.savePurchaseOrderItems.mockRejectedValue(error);
    
    // Act
    await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
    // Assert
    expect(purchaseOrderService.analyzePurchaseOrder).toHaveBeenCalled();
    expect(purchaseOrderService.mapAnalysisResult).toHaveBeenCalled();
    expect(purchaseOrderService.updatePurchaseOrderRecord).toHaveBeenCalled();
    expect(purchaseOrderService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(purchaseOrderService.savePurchaseOrderItems).toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      mockPOId,
      { status: DocumentStatus.FAILED }
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
  
  // test('should log the analysis JSON URL when successful', async () => {
  //   // Act
  //   await purchaseOrderService.processPurchaseOrderAsync(mockPOId, mockBuffer);
    
  //   // Assert
    
  //   expect(global.console.log).toHaveBeenCalledWith(
  //     expect.stringContaining('Analysis JSON URL for purchase order')
  //   );
  // });
});
