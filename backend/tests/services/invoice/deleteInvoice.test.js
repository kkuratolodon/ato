const { of, throwError } = require('rxjs');
const invoiceService = require('../../../src/services/invoice/invoiceService');
const Sentry = require('../../../src/instrument');

jest.mock('../../../src/instrument', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn()
}));

jest.mock('../../../src/repositories/invoiceRepository', () => {
  return jest.fn().mockImplementation(() => ({
    delete: jest.fn(),
    findById: jest.fn()
  }));
});

jest.mock('rxjs', () => {
  const original = jest.requireActual('rxjs');
  return {
    ...original,
    from: jest.fn()
  };
});

describe('deleteInvoiceById', () => {
  const { from } = require('rxjs');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should delete an invoice successfully', async () => {
    const mockId = 'invoice-123';
    from.mockImplementation((input) => {
      if (typeof input === 'function' || input instanceof Promise) {
        return of(undefined);
      }
      return of(1);
    });
    
    const result = await invoiceService.deleteInvoiceById(mockId).toPromise();
    
    expect(invoiceService.invoiceRepository.delete).toHaveBeenCalledWith(mockId);
    expect(result).toEqual({ message: 'Invoice successfully deleted' });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test('should throw error when no invoice is deleted', async () => {
    const mockId = 'nonexistent-invoice';
    from.mockImplementation((input) => {
      if (typeof input === 'function' || input instanceof Promise) {
        return of(undefined);
      }
      return of(0);
    });
    
    await expect(invoiceService.deleteInvoiceById(mockId).toPromise())
      .rejects.toThrow('Failed to delete invoice: Failed to delete invoice with ID: nonexistent-invoice');
    
    expect(invoiceService.invoiceRepository.delete).toHaveBeenCalledWith(mockId);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  test('should throw error when deletion fails with database error', async () => {
    const mockId = 'invoice-123';
    const mockError = new Error('Database connection error');
    
    from.mockImplementation((input) => {
      if (typeof input === 'function' || input instanceof Promise) {
        return of(undefined);
      }
      return throwError(() => mockError);
    });
    
    await expect(invoiceService.deleteInvoiceById(mockId).toPromise())
      .rejects.toThrow('Failed to delete invoice: Database connection error');
    
    expect(invoiceService.invoiceRepository.delete).toHaveBeenCalledWith(mockId);
    expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
  });

  test('should handle empty string ID gracefully', async () => {
    const mockId = '';
    from.mockImplementation((input) => {
      if (typeof input === 'function' || input instanceof Promise) {
        return of(undefined);
      }
      return of(0);
    });
    
    await expect(invoiceService.deleteInvoiceById(mockId).toPromise())
      .rejects.toThrow(`Failed to delete invoice: Failed to delete invoice with ID: ${mockId}`);
    
    expect(invoiceService.invoiceRepository.delete).toHaveBeenCalledWith(mockId);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  test('should handle null ID gracefully', async () => {
    const mockId = null;
    from.mockImplementation((input) => {
      if (typeof input === 'function' || input instanceof Promise) {
        return of(undefined);
      }
      return of(0);
    });
    
    await expect(invoiceService.deleteInvoiceById(mockId).toPromise())
      .rejects.toThrow(`Failed to delete invoice: Failed to delete invoice with ID: ${mockId}`);
    
    expect(invoiceService.invoiceRepository.delete).toHaveBeenCalledWith(mockId);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  test('should handle undefined ID gracefully', async () => {
    const mockId = undefined;
    from.mockImplementation((input) => {
      if (typeof input === 'function' || input instanceof Promise) {
        return of(undefined);
      }
      return of(0);
    });
    
    await expect(invoiceService.deleteInvoiceById(mockId).toPromise())
      .rejects.toThrow(`Failed to delete invoice: Failed to delete invoice with ID: ${mockId}`);
    
    expect(invoiceService.invoiceRepository.delete).toHaveBeenCalledWith(mockId);
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});