// filepath: /Users/suryaputra/Downloads/fin-invoice-ocr-team6/backend/tests/services/purchaseOrder/purchaseOrderLoggerAdapter.test.js
const PurchaseOrderLoggerAdapter = require('../../../src/services/purchaseOrder/purchaseOrderLogger');
const PurchaseOrderLogger = require('../../../src/utils/logger/PurchaseOrderLogger');

// Mock PurchaseOrderLogger
jest.mock('../../../src/utils/logger/PurchaseOrderLogger', () => {
  const mockInstance = {
    logStatusRequest: jest.fn(),
    logStatusNotFound: jest.fn(),
    logStatusError: jest.fn(),
    logUploadStart: jest.fn(),
    logUploadSuccess: jest.fn(),
    logProcessingStart: jest.fn(),
    logAnalysisComplete: jest.fn(),
    logProcessingComplete: jest.fn(),
    logError: jest.fn(),
  };

  return {
    getInstance: jest.fn(() => mockInstance),
    instance: mockInstance
  };
});

describe('PurchaseOrderLoggerAdapter', () => {
  let loggerInstance;
  
  beforeEach(() => {
    // Get the mock logger instance
    loggerInstance = PurchaseOrderLogger.getInstance();
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('Static adapter methods for status-related operations (lines 10-18)', () => {
    it('should call logStatusRequest with correct parameters', () => {
      const purchaseOrderId = 'po-123';
      const status = 'Completed';
      
      PurchaseOrderLoggerAdapter.logStatusRequest(purchaseOrderId, status);
      
      expect(loggerInstance.logStatusRequest).toHaveBeenCalledWith(purchaseOrderId, status);
      expect(loggerInstance.logStatusRequest).toHaveBeenCalledTimes(1);
    });
    
    it('should call logStatusNotFound with correct parameter', () => {
      const purchaseOrderId = 'po-123';
      
      PurchaseOrderLoggerAdapter.logStatusNotFound(purchaseOrderId);
      
      expect(loggerInstance.logStatusNotFound).toHaveBeenCalledWith(purchaseOrderId);
      expect(loggerInstance.logStatusNotFound).toHaveBeenCalledTimes(1);
    });
    
    it('should call logStatusError with correct parameters', () => {
      const purchaseOrderId = 'po-123';
      const error = new Error('Database error');
      
      PurchaseOrderLoggerAdapter.logStatusError(purchaseOrderId, error);
      
      expect(loggerInstance.logStatusError).toHaveBeenCalledWith(purchaseOrderId, error);
      expect(loggerInstance.logStatusError).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Static adapter methods for upload and processing (lines 22-42)', () => {
    it('should call logUploadStart with correct parameters', () => {
      const purchaseOrderId = 'po-123';
      const partnerId = 'partner-456';
      const filename = 'test-file.pdf';
      
      PurchaseOrderLoggerAdapter.logUploadStart(purchaseOrderId, partnerId, filename);
      
      expect(loggerInstance.logUploadStart).toHaveBeenCalledWith(purchaseOrderId, partnerId, filename);
      expect(loggerInstance.logUploadStart).toHaveBeenCalledTimes(1);
    });
    
    it('should call logUploadSuccess with correct parameters', () => {
      const purchaseOrderId = 'po-123';
      const s3Url = 'https://bucket.s3.amazonaws.com/file.pdf';
      
      PurchaseOrderLoggerAdapter.logUploadSuccess(purchaseOrderId, s3Url);
      
      expect(loggerInstance.logUploadSuccess).toHaveBeenCalledWith(purchaseOrderId, s3Url);
      expect(loggerInstance.logUploadSuccess).toHaveBeenCalledTimes(1);
    });
    
    it('should call logProcessingStart with correct parameter', () => {
      const purchaseOrderId = 'po-123';
      
      PurchaseOrderLoggerAdapter.logProcessingStart(purchaseOrderId);
      
      expect(loggerInstance.logProcessingStart).toHaveBeenCalledWith(purchaseOrderId);
      expect(loggerInstance.logProcessingStart).toHaveBeenCalledTimes(1);
    });
    
    it('should call logAnalysisComplete with correct parameters', () => {
      const purchaseOrderId = 'po-123';
      const jsonUrl = 'https://bucket.s3.amazonaws.com/analysis.json';
      
      PurchaseOrderLoggerAdapter.logAnalysisComplete(purchaseOrderId, jsonUrl);
      
      expect(loggerInstance.logAnalysisComplete).toHaveBeenCalledWith(purchaseOrderId, jsonUrl);
      expect(loggerInstance.logAnalysisComplete).toHaveBeenCalledTimes(1);
    });
    
    it('should call logProcessingComplete with correct parameter', () => {
      const purchaseOrderId = 'po-123';
      
      PurchaseOrderLoggerAdapter.logProcessingComplete(purchaseOrderId);
      
      expect(loggerInstance.logProcessingComplete).toHaveBeenCalledWith(purchaseOrderId);
      expect(loggerInstance.logProcessingComplete).toHaveBeenCalledTimes(1);
    });
    
    it('should call logError with correct parameters', () => {
      const purchaseOrderId = 'po-123';
      const error = new Error('Test error');
      const stage = 'Analysis';
      
      PurchaseOrderLoggerAdapter.logError(purchaseOrderId, error, stage);
      
      expect(loggerInstance.logError).toHaveBeenCalledWith(purchaseOrderId, error, stage);
      expect(loggerInstance.logError).toHaveBeenCalledTimes(1);
    });
  });
});