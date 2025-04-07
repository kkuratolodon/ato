const PurchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');
const PurchaseOrderRepository = require('../../../src/repositories/purchaseOrderRepository');
const Sentry = require('../../../src/instrument');

jest.mock('../../../src/repositories/purchaseOrderRepository');
jest.mock('../../../src/instrument');

describe('PurchaseOrderService', () => {
  let service;

  beforeEach(() => {
    service = PurchaseOrderService; // Use the singleton instance directly
    jest.clearAllMocks();
  });

  test('should handle errors during async processing', async () => {
    const purchaseOrderId = 'mock-id';
    const buffer = Buffer.from('test');
    const partnerId = 'partner-123';

    // Setup mocks
    service.purchaseOrderRepository.updateStatus = jest.fn().mockResolvedValue();
    Sentry.captureException = jest.fn();
    Sentry.addBreadcrumb = jest.fn();
    Sentry.captureMessage = jest.fn();

    // Create an error that will be thrown inside the method
    const testError = new Error('Processing error');
    service.purchaseOrderRepository.updateStatus.mockImplementationOnce(() => {
      // This will throw the first time it's called (during the normal flow)
      throw testError;
    });

    // Call the actual method, which should catch the error
    await service.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId);

    // Verify error handling
    expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    expect(service.purchaseOrderRepository.updateStatus).toHaveBeenCalledTimes(2);
    // First call - fails with error
    // Second call - the error handling updates status to "Failed"
    expect(service.purchaseOrderRepository.updateStatus.mock.calls[1][0]).toBe(purchaseOrderId);
    expect(service.purchaseOrderRepository.updateStatus.mock.calls[1][1]).toBe('Failed');
  });
});
