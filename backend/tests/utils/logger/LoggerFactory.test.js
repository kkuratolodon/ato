const { describe, it, expect, beforeEach } = require('@jest/globals');
const LoggerFactory = require('../../../src/utils/logger/LoggerFactory');
const InvoiceLogger = require('../../../src/utils/logger/InvoiceLogger');
const PurchaseOrderLogger = require('../../../src/utils/logger/PurchaseOrderLogger');

// Mock the logger modules
jest.mock('../../../src/utils/logger/InvoiceLogger');
jest.mock('../../../src/utils/logger/PurchaseOrderLogger');

describe('LoggerFactory', () => {
  const mockInvoiceLogger = {};
  const mockPurchaseOrderLogger = {};

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    InvoiceLogger.getInstance.mockReturnValue(mockInvoiceLogger);
    PurchaseOrderLogger.getInstance.mockReturnValue(mockPurchaseOrderLogger);
  });

  it('should create an InvoiceLogger instance for invoice document type', () => {
    const logger = LoggerFactory.createLogger('invoice');
    
    expect(InvoiceLogger.getInstance).toHaveBeenCalled();
    expect(logger).toBe(mockInvoiceLogger);
  });

  it('should create an InvoiceLogger instance for invoice document type (case insensitive)', () => {
    const logger = LoggerFactory.createLogger('INVOICE');
    
    expect(InvoiceLogger.getInstance).toHaveBeenCalled();
    expect(logger).toBe(mockInvoiceLogger);
  });

  it('should create a PurchaseOrderLogger instance for purchase-order document type', () => {
    const logger = LoggerFactory.createLogger('purchase-order');
    
    expect(PurchaseOrderLogger.getInstance).toHaveBeenCalled();
    expect(logger).toBe(mockPurchaseOrderLogger);
  });

  it('should create a PurchaseOrderLogger instance for purchase-order document type (case insensitive)', () => {
    const logger = LoggerFactory.createLogger('PURCHASE-ORDER');
    
    expect(PurchaseOrderLogger.getInstance).toHaveBeenCalled();
    expect(logger).toBe(mockPurchaseOrderLogger);
  });

  it('should throw an error for unknown document type', () => {
    expect(() => {
      LoggerFactory.createLogger('unknown-type');
    }).toThrow('Unknown document type: unknown-type');
  });
});