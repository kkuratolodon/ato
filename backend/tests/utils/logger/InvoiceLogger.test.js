const { describe, it, expect, beforeEach } = require('@jest/globals');
const InvoiceLogger = require('../../../src/utils/logger/InvoiceLogger');

// Mock the BaseLogger
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

describe('InvoiceLogger', () => {
  let instance;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset the singleton instance
    delete InvoiceLogger.instance;
    
    // Get a fresh instance for testing
    instance = InvoiceLogger.getInstance();
  });

  it('should create and return a singleton instance', () => {
    const instance1 = InvoiceLogger.getInstance();
    const instance2 = InvoiceLogger.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('should log upload start', () => {
    const invoiceId = 'inv12345';
    const partnerId = 'partner123';
    const filename = 'invoice.pdf';
    
    instance.logUploadStart(invoiceId, partnerId, filename);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Invoice upload initiated',
      expect.objectContaining({
        invoiceId,
        partnerId,
        filename,
        event: 'UPLOAD_START'
      })
    );
  });
  
  it('should log upload success', () => {
    const invoiceId = 'inv12345';
    const s3Url = 'https://bucket.s3.amazonaws.com/invoice.pdf';
    
    instance.logUploadSuccess(invoiceId, s3Url);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Invoice uploaded to S3',
      expect.objectContaining({
        invoiceId,
        s3Url,
        event: 'UPLOAD_SUCCESS'
      })
    );
  });
  
  it('should log processing start', () => {
    const invoiceId = 'inv12345';
    
    instance.logProcessingStart(invoiceId);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Starting invoice processing',
      expect.objectContaining({
        invoiceId,
        event: 'PROCESSING_START'
      })
    );
  });
  
  it('should log analysis complete', () => {
    const invoiceId = 'inv12345';
    const jsonUrl = 'https://bucket.s3.amazonaws.com/analysis.json';
    
    instance.logAnalysisComplete(invoiceId, jsonUrl);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Invoice analysis completed',
      expect.objectContaining({
        invoiceId,
        jsonUrl,
        event: 'ANALYSIS_COMPLETE'
      })
    );
  });
  
  it('should log data mapping complete', () => {
    const invoiceId = 'inv12345';
    const dataSummary = { 
      totalAmount: 1000, 
      currency: 'USD',
      items: 5 
    };
    
    instance.logDataMappingComplete(invoiceId, dataSummary);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Invoice data mapping completed',
      expect.objectContaining({
        invoiceId,
        dataSummary,
        event: 'MAPPING_COMPLETE'
      })
    );
  });
  
  it('should log processing complete', () => {
    const invoiceId = 'inv12345';
    
    instance.logProcessingComplete(invoiceId);
    
    expect(instance.info).toHaveBeenCalledWith(
      'Invoice processing completed successfully',
      expect.objectContaining({
        invoiceId,
        event: 'PROCESSING_COMPLETE'
      })
    );
  });
  
  it('should log error with complete error object', () => {
    const invoiceId = 'inv12345';
    const error = new Error('PDF parsing failed');
    const stage = 'extraction';
    
    instance.logError(invoiceId, error, stage);
    
    expect(instance.error).toHaveBeenCalledWith(
      'Error during invoice processing',
      expect.objectContaining({
        invoiceId,
        error: error.message,
        stack: error.stack,
        stage,
        event: 'PROCESSING_ERROR'
      })
    );
  });
  
  it('should log error with null error object', () => {
    const invoiceId = 'inv12345';
    const stage = 'extraction';
    
    instance.logError(invoiceId, null, stage);
    
    expect(instance.error).toHaveBeenCalledWith(
      'Error during invoice processing',
      expect.objectContaining({
        invoiceId,
        error: 'Unknown error',
        stack: '',
        stage,
        event: 'PROCESSING_ERROR'
      })
    );
  });
  
  it('should log validation error with error object', () => {
    const invoiceId = 'inv12345';
    const error = new Error('Invalid invoice format');
    
    instance.logValidationError(invoiceId, error);
    
    expect(instance.warn).toHaveBeenCalledWith(
      'Invoice validation failed',
      expect.objectContaining({
        invoiceId,
        error: error.message,
        event: 'VALIDATION_ERROR'
      })
    );
  });
  
  it('should log validation error with null error object', () => {
    const invoiceId = 'inv12345';
    
    instance.logValidationError(invoiceId, null);
    
    expect(instance.warn).toHaveBeenCalledWith(
      'Invoice validation failed',
      expect.objectContaining({
        invoiceId,
        error: 'Unknown error',
        event: 'VALIDATION_ERROR'
      })
    );
  });
});