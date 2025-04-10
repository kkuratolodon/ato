const winston = require('winston');
const InvoiceLogger = require('../../../src/services/invoice/invoiceLogger');

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

describe('InvoiceLogger', () => {
  let logger;
  
  beforeEach(() => {
    // Get the mock logger instance
    logger = winston.createLogger();
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('logProcessingStart', () => {
    it('should log processing start with correct parameters', () => {
      const invoiceId = 'invoice-123';
      
      InvoiceLogger.logProcessingStart(invoiceId);
      
      expect(logger.info).toHaveBeenCalledWith('Starting invoice processing', {
        invoiceId,
        event: 'PROCESSING_START'
      });
    });
  });
  
  describe('logAnalysisComplete', () => {
    it('should log analysis complete with correct parameters', () => {
      const invoiceId = 'invoice-123';
      const jsonUrl = 's3://bucket/analysis-results.json';
      
      InvoiceLogger.logAnalysisComplete(invoiceId, jsonUrl);
      
      expect(logger.info).toHaveBeenCalledWith('Invoice analysis completed', {
        invoiceId,
        jsonUrl,
        event: 'ANALYSIS_COMPLETE'
      });
    });
  });
  
  describe('logDataMappingComplete', () => {
    it('should log data mapping complete with correct parameters', () => {
      const invoiceId = 'invoice-123';
      const dataSummary = {
        totalAmount: 100.50,
        items: 5,
        vendor: 'Test Vendor'
      };
      
      InvoiceLogger.logDataMappingComplete(invoiceId, dataSummary);
      
      expect(logger.info).toHaveBeenCalledWith('Invoice data mapping completed', {
        invoiceId,
        dataSummary,
        event: 'MAPPING_COMPLETE'
      });
    });
  });
  
  describe('logProcessingComplete', () => {
    it('should log processing complete with correct parameters', () => {
      const invoiceId = 'invoice-123';
      
      InvoiceLogger.logProcessingComplete(invoiceId);
      
      expect(logger.info).toHaveBeenCalledWith('Invoice processing completed successfully', {
        invoiceId,
        event: 'PROCESSING_COMPLETE'
      });
    });
  });
  
  describe('logValidationError', () => {
    it('should log validation error with correct parameters', () => {
      const invoiceId = 'invoice-123';
      const error = new Error('Missing required fields');
      
      InvoiceLogger.logValidationError(invoiceId, error);
      
      expect(logger.warn).toHaveBeenCalledWith('Invoice validation failed', {
        invoiceId,
        error: error.message,
        event: 'VALIDATION_ERROR'
      });
    });
  });
});