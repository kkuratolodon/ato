const { Invoice } = require('@models/');
const InvoiceRepository = require('@repositories/invoiceRepository');

// Mock the models
jest.mock('@models/', () => ({
    Invoice: {
        create: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        destroy: jest.fn()
    }
}));

describe('InvoiceRepository', () => {
    let invoiceRepository;
    
    beforeEach(() => {
        invoiceRepository = new InvoiceRepository();
        // Reset mocks before each test
        jest.clearAllMocks();
        // Set default mock implementation for update to return success
        Invoice.update.mockResolvedValue([1, 1]); // Mock successful update with affected rows
    });

    describe('createInitial', () => {
        test('should create a new invoice successfully', async () => {
            const mockInvoiceData = { 
                title: 'Test Invoice',
                total_amount: 100.00
            };
            const mockCreatedInvoice = { 
                id: 1,
                ...mockInvoiceData
            };
            
            Invoice.create.mockResolvedValue(mockCreatedInvoice);
            
            const result = await invoiceRepository.createInitial(mockInvoiceData);
            
            expect(Invoice.create).toHaveBeenCalledWith(mockInvoiceData);
            expect(result).toEqual(mockCreatedInvoice);
        });

        test('should throw an error when creation fails', async () => {
            const mockInvoiceData = { title: 'Test Invoice' };
            const mockError = new Error('Database error');
            
            Invoice.create.mockRejectedValue(mockError);
            
            await expect(invoiceRepository.createInitial(mockInvoiceData))
                .rejects.toThrow(mockError);
            
            expect(Invoice.create).toHaveBeenCalledWith(mockInvoiceData);
        });
    });
    
    describe('findById', () => {
        test('should return an invoice when found', async () => {
            const mockInvoice = {
                id: 1,
                title: 'Test Invoice',
                get: jest.fn().mockReturnValue({
                    id: 1,
                    title: 'Test Invoice'
                })
            };
            
            Invoice.findOne.mockResolvedValue(mockInvoice);
            
            const result = await invoiceRepository.findById(1);
            
            expect(Invoice.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(mockInvoice.get).toHaveBeenCalledWith({ plain: true });
            expect(result).toEqual({
                id: 1,
                title: 'Test Invoice'
            });
        });

        test('should return null when invoice not found', async () => {
            Invoice.findOne.mockResolvedValue(null);
            
            const result = await invoiceRepository.findById(999);
            
            expect(Invoice.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
            expect(result).toBeNull();
        });

        test('should throw an error when database operation fails', async () => {
            const mockError = new Error('Database error');
            Invoice.findOne.mockRejectedValue(mockError);
            
            await expect(invoiceRepository.findById(1))
                .rejects.toThrow(mockError);
            
            expect(Invoice.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
        });
    });

    describe('update', () => {
        test('should update an invoice successfully', async () => {
            const mockData = { title: 'Updated Invoice' };
            
            await invoiceRepository.update(1, mockData);
            
            expect(Invoice.update).toHaveBeenCalledWith(mockData, { where: { id: 1 } });
        });

        test('should throw an error when update fails', async () => {
            const mockData = { title: 'Updated Invoice' };
            const mockError = new Error('Database error');
            
            Invoice.update.mockRejectedValueOnce(mockError);
            
            await expect(invoiceRepository.update(1, mockData))
                .rejects.toThrow(mockError);
            
            expect(Invoice.update).toHaveBeenCalledWith(mockData, { where: { id: 1 } });
        });
    });

    describe('updateStatus', () => {
        test('should update invoice status successfully', async () => {
            await invoiceRepository.updateStatus(1, 'APPROVED');
            
            expect(Invoice.update).toHaveBeenCalledWith({ status: 'APPROVED' }, { where: { id: 1 } });
        });

        test('should throw an error when status update fails', async () => {
            const mockError = new Error('Database error');
            Invoice.update.mockRejectedValueOnce(mockError);
            
            await expect(invoiceRepository.updateStatus(1, 'APPROVED'))
                .rejects.toThrow(mockError);
            
            expect(Invoice.update).toHaveBeenCalledWith({ status: 'APPROVED' }, { where: { id: 1 } });
        });
    });

    describe('updateCustomerId', () => {
        test('should update customer ID successfully', async () => {
            await invoiceRepository.updateCustomerId(1, 100);
            
            expect(Invoice.update).toHaveBeenCalledWith({ customer_id: 100 }, { where: { id: 1 } });
        });

        test('should handle null customer ID', async () => {
            await invoiceRepository.updateCustomerId(1, null);
            
            expect(Invoice.update).toHaveBeenCalledWith({ customer_id: null }, { where: { id: 1 } });
        });
    });

    describe('updateVendorId', () => {
        test('should update vendor ID successfully', async () => {
            await invoiceRepository.updateVendorId(1, 200);
            
            expect(Invoice.update).toHaveBeenCalledWith({ vendor_id: 200 }, { where: { id: 1 } });
        });

        test('should handle null vendor ID', async () => {
            await invoiceRepository.updateVendorId(1, null);
            
            expect(Invoice.update).toHaveBeenCalledWith({ vendor_id: null }, { where: { id: 1 } });
        });

        test('should throw an error with invalid ID type', async () => {
            const mockError = new Error('Invalid vendor ID');
            Invoice.update.mockRejectedValueOnce(mockError);
            
            await expect(invoiceRepository.updateVendorId(1, 'invalid-id'))
                .rejects.toThrow(mockError);
            
            expect(Invoice.update).toHaveBeenCalledWith({ vendor_id: 'invalid-id' }, { where: { id: 1 } });
        });
    });

    describe('delete', () => {
        test('should delete an invoice successfully', async () => {
            // Setup mock to return 1 (number of deleted rows)
            Invoice.destroy.mockResolvedValue(1);
            
            // Call the method
            await invoiceRepository.delete(1);
            
            // Verify destroy was called with correct parameters
            expect(Invoice.destroy).toHaveBeenCalledWith({ where: { id: 1 } });
        });

        test('should handle case when no invoice is deleted', async () => {
            // Setup mock to return 0 (no rows deleted)
            Invoice.destroy.mockResolvedValue(0);
            
            // Call the method
            await invoiceRepository.delete(999);
            
            // Verify destroy was called with correct parameters
            expect(Invoice.destroy).toHaveBeenCalledWith({ where: { id: 999 } });
        });

        test('should throw an error when delete operation fails', async () => {
            // Setup mock to throw an error
            const mockError = new Error('Database error during delete');
            Invoice.destroy.mockRejectedValue(mockError);
            
            // Expect the method to throw
            await expect(invoiceRepository.delete(1))
                .rejects.toThrow(mockError);
            
            // Verify destroy was called with correct parameters
            expect(Invoice.destroy).toHaveBeenCalledWith({ where: { id: 1 } });
        });
    });
});