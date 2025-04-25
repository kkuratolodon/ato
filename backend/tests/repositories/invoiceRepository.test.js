const { Invoice } = require('@models/');
const InvoiceRepository = require('@repositories/invoiceRepository');

// Mock the models
jest.mock('@models/', () => ({
    Invoice: {
        create: jest.fn(),
        findOne: jest.fn(),
        findByPk: jest.fn(),
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
        test('should soft delete invoice successfully', async () => {
            // Mock invoice instance
            const mockInvoice = {
                id: 1,
                destroy: jest.fn().mockResolvedValue(true)
            };
            
            Invoice.findByPk.mockResolvedValue(mockInvoice);
            
            await invoiceRepository.delete(1);
            
            expect(Invoice.findByPk).toHaveBeenCalledWith(1);
            expect(mockInvoice.destroy).toHaveBeenCalled();
        });
    
        test('should throw an error when delete fails', async () => {
            const mockError = new Error('Delete failed');
            const mockInvoice = {
                id: 1,
                destroy: jest.fn().mockRejectedValue(mockError)
            };
            
            Invoice.findByPk.mockResolvedValue(mockInvoice);
            
            await expect(invoiceRepository.delete(1))
                .rejects.toThrow(mockError);
           
            expect(Invoice.findByPk).toHaveBeenCalledWith(1);
            expect(mockInvoice.destroy).toHaveBeenCalled();
        });
    
        test('should handle non-existent ID gracefully', async () => {
            Invoice.findByPk.mockResolvedValue(null);
            
            await invoiceRepository.delete(999);
            
            expect(Invoice.findByPk).toHaveBeenCalledWith(999);
        });
    });

    describe('hardDelete', () => {
        test('should permanently delete invoice', async () => {
            await invoiceRepository.hardDelete(1);
            
            expect(Invoice.destroy).toHaveBeenCalledWith({ 
                where: { id: 1 },
                force: true
            });
        });

        test('should throw an error when hard delete fails', async () => {
            const mockError = new Error('Hard delete failed');
            
            Invoice.destroy = jest.fn().mockRejectedValue(mockError);
            
            await expect(invoiceRepository.hardDelete(1))
              .rejects.toThrow(mockError);
            
            expect(Invoice.destroy).toHaveBeenCalledWith({ 
              where: { id: 1 },
              force: true
            });
          });

        test('should handle non-existent ID when hard deleting', async () => {
            Invoice.destroy.mockResolvedValueOnce(0); 
            
            await invoiceRepository.hardDelete(999);
            
            expect(Invoice.destroy).toHaveBeenCalledWith({ 
                where: { id: 999 },
                force: true
            });
        });
    });

    describe('restore', () => {
        test('should restore soft-deleted invoice successfully', async () => {
            const mockInvoice = {
                id: 1,
                deleted_at: new Date(),
                restore: jest.fn().mockResolvedValue(true)
            };
            
            Invoice.findByPk = jest.fn().mockResolvedValue(mockInvoice);
            
            const result = await invoiceRepository.restore(1);
            
            expect(Invoice.findByPk).toHaveBeenCalledWith(1, { paranoid: false });
            expect(mockInvoice.restore).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        test('should return false when invoice is not found', async () => {
            Invoice.findByPk = jest.fn().mockResolvedValue(null);
            
            const result = await invoiceRepository.restore(999);
            
            expect(Invoice.findByPk).toHaveBeenCalledWith(999, { paranoid: false });
            expect(result).toBe(false);
        });

        test('should return false when invoice is not soft-deleted', async () => {
            const mockInvoice = {
                id: 1,
                deleted_at: null,
                restore: jest.fn()
            };
            
            Invoice.findByPk = jest.fn().mockResolvedValue(mockInvoice);
            
            const result = await invoiceRepository.restore(1);
            
            expect(Invoice.findByPk).toHaveBeenCalledWith(1, { paranoid: false });
            expect(mockInvoice.restore).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        test('should throw error when restore operation fails', async () => {
            const mockError = new Error('Restore failed');
            const mockInvoice = {
                id: 1,
                deleted_at: new Date(),
                restore: jest.fn().mockRejectedValue(mockError)
            };
            
            Invoice.findByPk = jest.fn().mockResolvedValue(mockInvoice);
            
            await expect(invoiceRepository.restore(1))
                .rejects.toThrow(mockError);
            expect(Invoice.findByPk).toHaveBeenCalledWith(1, { paranoid: false });
            expect(mockInvoice.restore).toHaveBeenCalled();
        });
    });
    
});