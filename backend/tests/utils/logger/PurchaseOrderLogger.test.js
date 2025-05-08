const { describe, it, expect, beforeEach } = require('@jest/globals');
const PurchaseOrderLogger = require('../../../src/utils/logger/PurchaseOrderLogger');

// We'll spy on the actual methods directly instead of using complex mocking
jest.mock('../../../src/utils/logger/BaseLogger', () => {
  return class MockBaseLogger {
    constructor() {
      this.info = jest.fn();
      this.warn = jest.fn();
      this.error = jest.fn();
      this.createMetadata = jest.fn((data, eventType) => ({
        ...data,
        event: eventType
      }));
    }
  };
});

describe('PurchaseOrderLogger', () => {
  let instance;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset the singleton instance
    delete PurchaseOrderLogger.instance;
    
    // Get a fresh instance for testing
    instance = PurchaseOrderLogger.getInstance();
  });

  it('should create and return a singleton instance', () => {
    const instance1 = PurchaseOrderLogger.getInstance();
    const instance2 = PurchaseOrderLogger.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('should log status request information', () => {
    const purchaseOrderId = 'po12345';
    const status = 'PROCESSING';
    
    instance.logStatusRequest(purchaseOrderId, status);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Purchase order status requested',
      expect.objectContaining({
        purchaseOrderId,
        status,
        event: 'STATUS_REQUEST'
      })
    );
  });
  
  it('should log status not found warning', () => {
    const purchaseOrderId = 'po12345';
    
    instance.logStatusNotFound(purchaseOrderId);
    
    expect(instance.warn).toHaveBeenCalledWith(
      'Purchase order status not found',
      expect.objectContaining({
        purchaseOrderId,
        event: 'STATUS_NOT_FOUND'
      })
    );
  });
  
  it('should log status error with error object', () => {
    const purchaseOrderId = 'po12345';
    const error = new Error('Database error');
    
    instance.logStatusError(purchaseOrderId, error);
    
    expect(instance.error).toHaveBeenCalledWith(
      'Error retrieving purchase order status',
      expect.objectContaining({
        purchaseOrderId,
        error: error.message,
        stack: error.stack,
        event: 'STATUS_ERROR'
      })
    );
  });
  
  it('should log status error with null error', () => {
    const purchaseOrderId = 'po12345';
    
    instance.logStatusError(purchaseOrderId, null);
    
    expect(instance.error).toHaveBeenCalledWith(
      'Error retrieving purchase order status',
      expect.objectContaining({
        purchaseOrderId,
        error: 'Unknown error',
        stack: '',
        event: 'STATUS_ERROR'
      })
    );
  });
  
  it('should log upload start', () => {
    const purchaseOrderId = 'po12345';
    const partnerId = 'partner123';
    const filename = 'purchase_order.pdf';
    
    instance.logUploadStart(purchaseOrderId, partnerId, filename);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Purchase order upload initiated',
      expect.objectContaining({
        purchaseOrderId,
        partnerId,
        filename,
        event: 'UPLOAD_START'
      })
    );
  });
  
  it('should log upload success', () => {
    const purchaseOrderId = 'po12345';
    const s3Url = 'https://bucket.s3.amazonaws.com/purchase_order.pdf';
    
    instance.logUploadSuccess(purchaseOrderId, s3Url);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Purchase order uploaded to S3',
      expect.objectContaining({
        purchaseOrderId,
        s3Url,
        event: 'UPLOAD_SUCCESS'
      })
    );
  });
  
  it('should log processing start', () => {
    const purchaseOrderId = 'po12345';
    
    instance.logProcessingStart(purchaseOrderId);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Starting purchase order processing',
      expect.objectContaining({
        purchaseOrderId,
        event: 'PROCESSING_START'
      })
    );
  });
  
  it('should log analysis complete', () => {
    const purchaseOrderId = 'po12345';
    const jsonUrl = 'https://bucket.s3.amazonaws.com/analysis.json';
    
    instance.logAnalysisComplete(purchaseOrderId, jsonUrl);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Purchase order analysis completed',
      expect.objectContaining({
        purchaseOrderId,
        jsonUrl,
        event: 'ANALYSIS_COMPLETE'
      })
    );
  });
  
  it('should log processing complete', () => {
    const purchaseOrderId = 'po12345';
    
    instance.logProcessingComplete(purchaseOrderId);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Purchase order processing completed successfully',
      expect.objectContaining({
        purchaseOrderId,
        event: 'PROCESSING_COMPLETE'
      })
    );
  });
  
  it('should log error with complete error object', () => {
    const purchaseOrderId = 'po12345';
    const error = new Error('PDF parsing failed');
    const stage = 'extraction';
    
    instance.logError(purchaseOrderId, error, stage);
    
    expect(instance.error).toHaveBeenCalledWith(
      'Error during purchase order processing',
      expect.objectContaining({
        purchaseOrderId,
        error: error.message,
        stack: error.stack,
        stage,
        event: 'PROCESSING_ERROR'
      })
    );
  });
  
  it('should log error with null error object', () => {
    const purchaseOrderId = 'po12345';
    const stage = 'extraction';
    
    instance.logError(purchaseOrderId, null, stage);
    
    expect(instance.error).toHaveBeenCalledWith(
      'Error during purchase order processing',
      expect.objectContaining({
        purchaseOrderId,
        error: 'Unknown error',
        stack: '',
        stage,
        event: 'PROCESSING_ERROR'
      })
    );
  });
});