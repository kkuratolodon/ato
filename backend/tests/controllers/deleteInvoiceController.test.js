const { controller } = require('../../src/controllers/invoiceController');
const InvoiceService = require('../../src/services/invoice/invoiceService');
const validateDeletion = require('../../src/services/validateDeletion');
const s3Service = require('../../src/services/s3Service');

// Mock dependencies
jest.mock('../../src/services/invoice/invoiceService');
jest.mock('../../src/services/validateDeletion');
jest.mock('../../src/services/s3Service');

describe('Delete Invoice Controller Tests', () => {
    let mockRequest;
    let mockResponse;
    
    beforeEach(() => {
        mockRequest = {
            params: {},
            user: { uuid: 'user-123' }
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
    });

    test('should return 400 if invoice ID is invalid', async () => {
        // Test cases for invalid IDs
        const invalidIds = ['', 'abc', '0', '-1'];
        
        for (const id of invalidIds) {
            mockRequest.params = { id };
            await controller.deleteInvoiceById(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: "Invalid invoice ID" });
        }
    });

    test('should return 401 if user is not authenticated', async () => {
        mockRequest.params = { id: '1' };
        mockRequest.user = null;
        
        await controller.deleteInvoiceById(mockRequest, mockResponse);
        
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    });

    test('should return 404 if invoice not found', async () => {
        mockRequest.params = { id: '1' };
        validateDeletion.validateInvoiceDeletion.mockRejectedValue(new Error('Invoice not found'));
        
        await controller.deleteInvoiceById(mockRequest, mockResponse);
        
        expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith('user-123', 1);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invoice not found' });
    });

    test('should return 403 if user does not own the invoice', async () => {
        mockRequest.params = { id: '1' };
        validateDeletion.validateInvoiceDeletion.mockRejectedValue(new Error('Unauthorized: You do not own this invoice'));
        
        await controller.deleteInvoiceById(mockRequest, mockResponse);
        
        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized: You do not own this invoice' });
    });

    test('should return 409 if invoice cannot be deleted due to its status', async () => {
        mockRequest.params = { id: '1' };
        validateDeletion.validateInvoiceDeletion.mockRejectedValue(new Error('Invoice cannot be deleted unless it is Analyzed'));
        
        await controller.deleteInvoiceById(mockRequest, mockResponse);
        
        expect(mockResponse.status).toHaveBeenCalledWith(409);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invoice cannot be deleted unless it is Analyzed' });
    });

    test('should return 500 if S3 file deletion fails', async () => {
        mockRequest.params = { id: '1' };
        const mockInvoice = { file_url: 'https://bucket.s3.amazonaws.com/file-key.pdf' };
        
        validateDeletion.validateInvoiceDeletion.mockResolvedValue(mockInvoice);
        s3Service.deleteFile.mockResolvedValue({ success: false, error: 'S3 error' });
        
        await controller.deleteInvoiceById(mockRequest, mockResponse);
        
        expect(s3Service.deleteFile).toHaveBeenCalledWith('file-key.pdf');
        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({ 
            message: 'Failed to delete file from S3', 
            error: 'S3 error' 
        });
    });

    test('should successfully delete invoice with file', async () => {
        mockRequest.params = { id: '1' };
        const mockInvoice = { file_url: 'https://bucket.s3.amazonaws.com/file-key.pdf' };
        
        validateDeletion.validateInvoiceDeletion.mockResolvedValue(mockInvoice);
        s3Service.deleteFile.mockResolvedValue({ success: true });
        InvoiceService.deleteInvoiceById.mockResolvedValue(true);
        
        await controller.deleteInvoiceById(mockRequest, mockResponse);
        
        expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith('user-123', 1);
        expect(s3Service.deleteFile).toHaveBeenCalledWith('file-key.pdf');
        expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith('1');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: "Invoice successfully deleted" });
    });

    test('should successfully delete invoice without file', async () => {
        mockRequest.params = { id: '1' };
        const mockInvoice = { file_url: null };
        
        validateDeletion.validateInvoiceDeletion.mockResolvedValue(mockInvoice);
        InvoiceService.deleteInvoiceById.mockResolvedValue(true);
        
        await controller.deleteInvoiceById(mockRequest, mockResponse);
        
        expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith('user-123', 1);
        expect(s3Service.deleteFile).not.toHaveBeenCalled();
        expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith('1');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: "Invoice successfully deleted" });
    });

    test('should return 500 on unexpected error', async () => {
        mockRequest.params = { id: '1' };
        validateDeletion.validateInvoiceDeletion.mockRejectedValue(new Error('Unexpected error'));
        
        await controller.deleteInvoiceById(mockRequest, mockResponse);
        
        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });

    test('should return 500 when invoice deletion fails', async () => {
        // Setup: Valid invoice that passes validation
        mockRequest.params = { id: '1' };
        const mockInvoice = { file_url: null };
        
        validateDeletion.validateInvoiceDeletion.mockResolvedValue(mockInvoice);
        // Simulate error during deletion process
        InvoiceService.deleteInvoiceById.mockRejectedValue(new Error('Database connection error'));
        
        await controller.deleteInvoiceById(mockRequest, mockResponse);
        
        // Verify the catch block at line 139 returns 500
        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });

});