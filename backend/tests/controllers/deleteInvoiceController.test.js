const { deleteInvoiceById } = require('../../src/controllers/invoiceController');
const InvoiceService = require('../../src/services/invoice/invoiceService');
const validateDeletion = require('../../src/services/validateDeletion');
const s3Service = require('../../src/services/s3Service');

// Mock dependencies
jest.mock('../../src/services/invoice/invoiceService');
jest.mock('../../src/services/validateDeletion');
jest.mock('../../src/services/s3Service');

describe('deleteInvoiceById Controller', () => {
  let req;
  let res;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup request and response objects
    req = {
      params: { id: '123' },
      user: { uuid: 'user-123' }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  // POSITIVE TEST CASES
  
  test('should successfully delete an invoice', async () => {
    // Mock successful validation
    validateDeletion.validateInvoiceDeletion.mockResolvedValue({
      id: '123',
      file_url: 'https://example.com/invoice-123.pdf'
    });
    
    // Mock successful S3 deletion
    s3Service.deleteFile.mockResolvedValue({ success: true });
    
    // Mock successful database deletion
    InvoiceService.deleteInvoiceById.mockResolvedValue(true);
    
    await deleteInvoiceById(req, res);
    
    expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith('user-123', '123');
    expect(s3Service.deleteFile).toHaveBeenCalledWith('invoice-123.pdf');
    expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith('123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invoice successfully deleted' });
  });

  test('should successfully delete an invoice without file_url', async () => {
    // Mock successful validation with no file_url
    validateDeletion.validateInvoiceDeletion.mockResolvedValue({ id: '123' });
    
    // Mock successful database deletion
    InvoiceService.deleteInvoiceById.mockResolvedValue(true);
    
    await deleteInvoiceById(req, res);
    
    expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith('user-123', '123');
    expect(s3Service.deleteFile).not.toHaveBeenCalled();
    expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith('123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invoice successfully deleted' });
  });
  
  // NEGATIVE TEST CASES
  
  test('should return 404 if invoice not found', async () => {
    validateDeletion.validateInvoiceDeletion.mockRejectedValue(new Error('Invoice not found'));
    
    await deleteInvoiceById(req, res);
    
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invoice not found' });
    expect(s3Service.deleteFile).not.toHaveBeenCalled();
    expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
  });
  
  test('should return 403 if user does not own the invoice', async () => {
    validateDeletion.validateInvoiceDeletion.mockRejectedValue(
      new Error('Unauthorized: You do not own this invoice')
    );
    
    await deleteInvoiceById(req, res);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: You do not own this invoice' });
    expect(s3Service.deleteFile).not.toHaveBeenCalled();
    expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
  });
  
  test('should return 409 if invoice status prevents deletion', async () => {
    validateDeletion.validateInvoiceDeletion.mockRejectedValue(
      new Error('Invoice cannot be deleted unless it is Analyzed')
    );
    
    await deleteInvoiceById(req, res);
    
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invoice cannot be deleted unless it is Analyzed' });
    expect(s3Service.deleteFile).not.toHaveBeenCalled();
    expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
  });
  
  test('should return 500 if S3 deletion fails', async () => {
    validateDeletion.validateInvoiceDeletion.mockResolvedValue({
      id: '123',
      file_url: 'https://example.com/invoice-123.pdf'
    });
    
    s3Service.deleteFile.mockResolvedValue({ 
      success: false, 
      error: 'Failed to delete file'
    });
    
    await deleteInvoiceById(req, res);
    
    expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith('user-123', '123');
    expect(s3Service.deleteFile).toHaveBeenCalledWith('invoice-123.pdf');
    expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ 
      message: 'Failed to delete file from S3', 
      error: 'Failed to delete file' 
    });
  });
  
  test('should return 500 if database deletion fails', async () => {
    validateDeletion.validateInvoiceDeletion.mockResolvedValue({
      id: '123',
      file_url: 'https://example.com/invoice-123.pdf'
    });
    
    s3Service.deleteFile.mockResolvedValue({ success: true });
    
    InvoiceService.deleteInvoiceById.mockRejectedValue(new Error('Database error'));
    
    await deleteInvoiceById(req, res);
    
    expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith('user-123', '123');
    expect(s3Service.deleteFile).toHaveBeenCalledWith('invoice-123.pdf');
    expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith('123');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
  });
  
  test('should return 500 for unknown validation errors', async () => {
    validateDeletion.validateInvoiceDeletion.mockRejectedValue(new Error('Unknown error'));
    
    await deleteInvoiceById(req, res);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    expect(s3Service.deleteFile).not.toHaveBeenCalled();
    expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
  });
});
