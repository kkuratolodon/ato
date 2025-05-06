const winston = require('winston');
const PurchaseOrderLogger = require('../../../src/services/purchaseOrder/purchaseOrderLogger');

// Mock winston logger
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  
  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      timestamp: jest.fn(() => ({})),
      json: jest.fn(() => ({})),
      errors: jest.fn(() => ({})),
      combine: jest.fn(),
      colorize: jest.fn(() => ({})),
      simple: jest.fn(() => ({}))
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

describe('PurchaseOrderLogger', () => {
  let logger;
  
  beforeEach(() => {
    // Get the mock logger instance
    logger = winston.createLogger();
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('logStatusRequest', () => {
    it('should log status request with correct parameters', () => {
      const purchaseOrderId = 'po-123';
      const status = 'Analyzed';
      
      PurchaseOrderLogger.logStatusRequest(purchaseOrderId, status);
      
      expect(logger.info).toHaveBeenCalledWith('Purchase order status requested', {
        purchaseOrderId,
        status,
        event: 'STATUS_REQUEST'
      });
    });
    
    it('should handle different status values', () => {
      const testCases = [
        { id: 'po-123', status: 'Processing' },
        { id: 'po-456', status: 'Failed' },
        { id: 'po-789', status: null },
        { id: 'po-000', status: undefined }
      ];
      
      testCases.forEach(({ id, status }) => {
        PurchaseOrderLogger.logStatusRequest(id, status);
        
        expect(logger.info).toHaveBeenCalledWith('Purchase order status requested', {
          purchaseOrderId: id,
          status,
          event: 'STATUS_REQUEST'
        });
      });
      
      // Should have been called once for each test case
      expect(logger.info).toHaveBeenCalledTimes(testCases.length);
    });
  });
  
  describe('logStatusNotFound', () => {
    it('should log status not found with correct parameters', () => {
      const purchaseOrderId = 'po-123';
      
      PurchaseOrderLogger.logStatusNotFound(purchaseOrderId);
      
      expect(logger.warn).toHaveBeenCalledWith('Purchase order status not found', {
        purchaseOrderId,
        event: 'STATUS_NOT_FOUND'
      });
    });
    
    it('should handle missing purchase order ID', () => {
      const testCases = [
        { id: null },
        { id: undefined },
        { id: '' }
      ];
      
      testCases.forEach(({ id }) => {
        PurchaseOrderLogger.logStatusNotFound(id);
        
        expect(logger.warn).toHaveBeenCalledWith('Purchase order status not found', {
          purchaseOrderId: id,
          event: 'STATUS_NOT_FOUND'
        });
      });
      
      expect(logger.warn).toHaveBeenCalledTimes(testCases.length);
    });
  });
  
  describe('logStatusError', () => {
    it('should log status error with correct parameters', () => {
      const purchaseOrderId = 'po-123';
      const error = new Error('Database connection failed');
      
      PurchaseOrderLogger.logStatusError(purchaseOrderId, error);
      
      expect(logger.error).toHaveBeenCalledWith('Error retrieving purchase order status', {
        purchaseOrderId,
        error: error.message,
        stack: error.stack,
        event: 'STATUS_ERROR'
      });
    });
    
    it('should handle different types of errors', () => {
      const purchaseOrderId = 'po-123';
      const testCases = [
        { error: new Error('Database error') },
        { error: new TypeError('Type error') },
        { error: { message: 'Custom error', stack: 'Custom stack' } }
      ];
      
      testCases.forEach(({ error }) => {
        PurchaseOrderLogger.logStatusError(purchaseOrderId, error);
        
        expect(logger.error).toHaveBeenCalledWith('Error retrieving purchase order status', {
          purchaseOrderId,
          error: error.message,
          stack: error.stack,
          event: 'STATUS_ERROR'
        });
      });
      
      expect(logger.error).toHaveBeenCalledTimes(testCases.length);
    });
    
    it('should handle null or undefined errors gracefully', () => {
      const purchaseOrderId = 'po-123';
      const testCases = [
        { error: null },
        { error: undefined }
      ];
      
      testCases.forEach(({ error }) => {
        // This shouldn't throw an exception
        PurchaseOrderLogger.logStatusError(purchaseOrderId, error);
        
        expect(logger.error).toHaveBeenCalled();
      });
    });
  });
});