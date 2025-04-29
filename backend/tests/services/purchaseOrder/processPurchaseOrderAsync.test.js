const Sentry = require('../../../src/instrument');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');
const PurchaseOrderService = require('@services/purchaseOrder/purchaseOrderService');

// Mock dependencies
jest.mock('../../../src/instrument', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn()
}));

// Mock other repositories
jest.mock('@repositories/purchaseOrderRepository');
jest.mock('@repositories/customerRepository');
jest.mock('@repositories/vendorRepository');
jest.mock('@repositories/itemRepository');
jest.mock('@services/analysis/azureDocumentAnalyzer');
jest.mock('@services/purchaseOrderMapperService/purchaseOrderMapperService');

describe('PurchaseOrderService.processPurchaseOrderAsync direct implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock methods directly on the PurchaseOrderService singleton
    PurchaseOrderService.analyzePurchaseOrder = jest.fn().mockResolvedValue({ data: 'test data' });
    PurchaseOrderService.uploadAnalysisResults = jest.fn().mockResolvedValue('https://example.com/analysis.json');
    PurchaseOrderService.mapAnalysisResult = jest.fn().mockReturnValue({
      purchaseOrderData: { purchase_order_number: 'PO-001' },
      customerData: { name: 'Test Customer' },
      vendorData: { name: 'Test Vendor' },
      itemsData: [{ description: 'Test Item' }]
    });
    
    PurchaseOrderService.updatePurchaseOrderRecord = jest.fn().mockResolvedValue();
    PurchaseOrderService.updateCustomerAndVendorData = jest.fn().mockResolvedValue();
    PurchaseOrderService.savePurchaseOrderItems = jest.fn().mockResolvedValue();
    
    // Mock directly on repository instances
    PurchaseOrderService.purchaseOrderRepository.update = jest.fn().mockResolvedValue();
    
    // Mock console to avoid cluttering test output
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });

  test('should process purchase order successfully', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'test-uuid-123';

    // Act
    await PurchaseOrderService.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "purchaseOrderProcessing",
      message: `Starting async processing for purchase order ${uuid}`,
      level: "info"
    });
    
    expect(PurchaseOrderService.analyzePurchaseOrder).toHaveBeenCalledWith(buffer);
    expect(PurchaseOrderService.uploadAnalysisResults).toHaveBeenCalled();
    expect(PurchaseOrderService.mapAnalysisResult).toHaveBeenCalledWith(
      { data: 'test data' }, partnerId, originalname, buffer.length
    );
    
    expect(PurchaseOrderService.updatePurchaseOrderRecord).toHaveBeenCalledWith(
      purchaseOrderId, 
      { 
        purchase_order_number: 'PO-001',
        analysis_json_url: 'https://example.com/analysis.json'
      }
    );
    expect(PurchaseOrderService.updateCustomerAndVendorData).toHaveBeenCalledWith(
      purchaseOrderId, { name: 'Test Customer' }, { name: 'Test Vendor' }
    );
    expect(PurchaseOrderService.savePurchaseOrderItems).toHaveBeenCalledWith(
      purchaseOrderId, [{ description: 'Test Item' }]
    );
    
    expect(PurchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(
      purchaseOrderId, { status: DocumentStatus.ANALYZED }
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      `Successfully completed processing purchase order ${uuid}`
    );
  });

  test('should handle error during document analysis', async () => {
    // Arrange
    const purchaseOrderId = 'error-purchase-order-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Analysis error');
    PurchaseOrderService.analyzePurchaseOrder.mockRejectedValue(error);

    // Act
    await PurchaseOrderService.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(PurchaseOrderService.analyzePurchaseOrder).toHaveBeenCalledWith(buffer);
    expect(PurchaseOrderService.mapAnalysisResult).not.toHaveBeenCalled();
    expect(PurchaseOrderService.updatePurchaseOrderRecord).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(PurchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(purchaseOrderId, { status: DocumentStatus.FAILED });
  });

  test('should handle error during mapAnalysisResult', async () => {
    // Arrange
    const purchaseOrderId = 'error-purchase-order-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Mapping error');
    PurchaseOrderService.mapAnalysisResult.mockImplementation(() => {
      throw error;
    });

    // Act
    await PurchaseOrderService.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(PurchaseOrderService.analyzePurchaseOrder).toHaveBeenCalled();
    expect(PurchaseOrderService.mapAnalysisResult).toHaveBeenCalled();
    expect(PurchaseOrderService.updatePurchaseOrderRecord).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(PurchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(purchaseOrderId, { status: DocumentStatus.FAILED });
  });

  test('should handle error during updatePurchaseOrderRecord', async () => {
    // Arrange
    const purchaseOrderId = 'error-purchase-order-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Update error');
    PurchaseOrderService.updatePurchaseOrderRecord.mockRejectedValue(error);

    // Act
    await PurchaseOrderService.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(PurchaseOrderService.analyzePurchaseOrder).toHaveBeenCalled();
    expect(PurchaseOrderService.mapAnalysisResult).toHaveBeenCalled();
    expect(PurchaseOrderService.updatePurchaseOrderRecord).toHaveBeenCalled();
    expect(PurchaseOrderService.updateCustomerAndVendorData).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(PurchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(purchaseOrderId, { status: DocumentStatus.FAILED });
  });

  test('should handle error during updateCustomerAndVendorData', async () => {
    // Arrange
    const purchaseOrderId = 'error-purchase-order-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Customer/Vendor error');
    PurchaseOrderService.updateCustomerAndVendorData.mockRejectedValue(error);

    // Act
    await PurchaseOrderService.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(PurchaseOrderService.analyzePurchaseOrder).toHaveBeenCalled();
    expect(PurchaseOrderService.mapAnalysisResult).toHaveBeenCalled();
    expect(PurchaseOrderService.updatePurchaseOrderRecord).toHaveBeenCalled();
    expect(PurchaseOrderService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(PurchaseOrderService.savePurchaseOrderItems).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(PurchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(purchaseOrderId, { status: DocumentStatus.FAILED });
  });

  test('should handle error during savePurchaseOrderItems', async () => {
    // Arrange
    const purchaseOrderId = 'error-purchase-order-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Items error');
    PurchaseOrderService.savePurchaseOrderItems.mockRejectedValue(error);

    // Act
    await PurchaseOrderService.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(PurchaseOrderService.analyzePurchaseOrder).toHaveBeenCalled();
    expect(PurchaseOrderService.mapAnalysisResult).toHaveBeenCalled();
    expect(PurchaseOrderService.updatePurchaseOrderRecord).toHaveBeenCalled();
    expect(PurchaseOrderService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(PurchaseOrderService.savePurchaseOrderItems).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(PurchaseOrderService.purchaseOrderRepository.update).toHaveBeenCalledWith(purchaseOrderId, { status: DocumentStatus.FAILED });
  });

  test('should handle error during final status update', async () => {
    // Arrange
    const purchaseOrderId = 'error-purchase-order-123';
    const buffer = Buffer.from('test data');
    const partnerId = 'partner-123';
    const originalname = 'test.pdf';
    const uuid = 'error-uuid-123';

    const error = new Error('Status update error');
    PurchaseOrderService.purchaseOrderRepository.update.mockImplementation((id, status) => {
      if (status && status.status === 'Analyzed') {
        return Promise.reject(error);
      }
      return Promise.resolve();
    });

    // Act
    await PurchaseOrderService.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, uuid);

    // Assert
    expect(PurchaseOrderService.analyzePurchaseOrder).toHaveBeenCalled();
    expect(PurchaseOrderService.mapAnalysisResult).toHaveBeenCalled();
    expect(PurchaseOrderService.updatePurchaseOrderRecord).toHaveBeenCalled();
    expect(PurchaseOrderService.updateCustomerAndVendorData).toHaveBeenCalled();
    expect(PurchaseOrderService.savePurchaseOrderItems).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});