const { PurchaseOrder } = require('../../src/models');
const PurchaseOrderRepository = require('../../src/repositories/purchaseOrderRepository');

// Mock the models
jest.mock('../../src/models', () => ({
    PurchaseOrder: {
        create: jest.fn(),
        findByPk: jest.fn(),
        update: jest.fn(),
        destroy: jest.fn()
    }
}));

describe('PurchaseOrderRepository', () => {
    let purchaseOrderRepository;
    
    beforeEach(() => {
        purchaseOrderRepository = new PurchaseOrderRepository();
        // Reset mocks before each test
        jest.clearAllMocks();
        // Set default mock implementation for update to return success
        PurchaseOrder.update.mockResolvedValue([1, 1]); // Mock successful update with affected rows
    });

    describe('findById', () => {
        test('should return a purchase order when found', async () => {
            const mockPurchaseOrder = {
                id: 1,
                title: 'Test PO',
                amount: 500.00
            };
            
            PurchaseOrder.findByPk.mockResolvedValue(mockPurchaseOrder);
            
            const result = await purchaseOrderRepository.findById(1);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockPurchaseOrder);
        });

        test('should return null when purchase order not found', async () => {
            PurchaseOrder.findByPk.mockResolvedValue(null);
            
            const result = await purchaseOrderRepository.findById(999);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(999);
            expect(result).toBeNull();
        });

        test('should throw an error when database operation fails', async () => {
            const mockError = new Error('Database error');
            PurchaseOrder.findByPk.mockRejectedValue(mockError);
            
            await expect(purchaseOrderRepository.findById(1))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(1);
        });
    });

    describe('createInitial', () => {
        test('should create a new purchase order successfully', async () => {
            const mockPOData = { 
                title: 'Test Purchase Order',
                amount: 500.00
            };
            const mockCreatedPO = { 
                id: 1,
                ...mockPOData
            };
            
            PurchaseOrder.create.mockResolvedValue(mockCreatedPO);
            
            const result = await purchaseOrderRepository.createInitial(mockPOData);
            
            expect(PurchaseOrder.create).toHaveBeenCalledWith(mockPOData);
            expect(result).toEqual(mockCreatedPO);
        });

        test('should throw an error when creation fails', async () => {
            const mockPOData = { title: 'Test Purchase Order' };
            const mockError = new Error('Database error');
            
            PurchaseOrder.create.mockRejectedValue(mockError);
            
            await expect(purchaseOrderRepository.createInitial(mockPOData))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.create).toHaveBeenCalledWith(mockPOData);
        });
    });
    
    describe('update', () => {
        test('should update a purchase order successfully', async () => {
            const mockData = { title: 'Updated PO' };
            const mockUpdatedPO = {
                id: 1,
                title: 'Updated PO',
                amount: 500.00
            };
            
            PurchaseOrder.findByPk.mockResolvedValue(mockUpdatedPO);
            
            const result = await purchaseOrderRepository.update(1, mockData);
            
            expect(PurchaseOrder.update).toHaveBeenCalledWith(mockData, { where: { id: 1 } });
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockUpdatedPO);
        });

        test('should throw an error when update fails', async () => {
            const mockData = { title: 'Updated PO' };
            const mockError = new Error('Database error');
            
            PurchaseOrder.update.mockRejectedValue(mockError);
            
            await expect(purchaseOrderRepository.update(1, mockData))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.update).toHaveBeenCalledWith(mockData, { where: { id: 1 } });
        });
    });

    describe('updateStatus', () => {
        test('should update purchase order status successfully', async () => {
            await purchaseOrderRepository.updateStatus(1, 'APPROVED');
            
            expect(PurchaseOrder.update).toHaveBeenCalledWith({ status: 'APPROVED' }, { where: { id: 1 } });
        });

        test('should throw an error when status update fails', async () => {
            const mockError = new Error('Database error');
            PurchaseOrder.update.mockRejectedValue(mockError);
            
            await expect(purchaseOrderRepository.updateStatus(1, 'APPROVED'))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.update).toHaveBeenCalledWith({ status: 'APPROVED' }, { where: { id: 1 } });
        });
    });

    describe('delete', () => {
        test('should soft delete purchase order successfully', async () => {
            // Mock PurchaseOrder instance
            const mockPurchaseOrder = {
                id: 1,
                destroy: jest.fn().mockResolvedValue(true)
            };
            
            PurchaseOrder.findByPk.mockResolvedValue(mockPurchaseOrder);
            
            await purchaseOrderRepository.delete(1);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(1);
            expect(mockPurchaseOrder.destroy).toHaveBeenCalled();
        });
    
        test('should throw an error when delete fails', async () => {
            const mockError = new Error('Delete failed');
            const mockPurchaseOrder = {
                id: 1,
                destroy: jest.fn().mockRejectedValue(mockError)
            };
            
            PurchaseOrder.findByPk.mockResolvedValue(mockPurchaseOrder);
            
            await expect(purchaseOrderRepository.delete(1))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(1);
            expect(mockPurchaseOrder.destroy).toHaveBeenCalled();
        });
    
        test('should handle non-existent ID gracefully', async () => {
            PurchaseOrder.findByPk.mockResolvedValue(null);
            
            await purchaseOrderRepository.delete(999);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(999);
        });
    });

    describe('hardDelete', () => {
        test('should permanently delete purchase order', async () => {
            await purchaseOrderRepository.hardDelete(1);
            
            expect(PurchaseOrder.destroy).toHaveBeenCalledWith({ 
                where: { id: 1 },
                force: true
            });
        });

        test('should throw an error when hard delete fails', async () => {
            const mockError = new Error('Hard delete failed');
            PurchaseOrder.destroy.mockRejectedValueOnce(mockError);
            
            await expect(purchaseOrderRepository.hardDelete(1))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.destroy).toHaveBeenCalledWith({ 
                where: { id: 1 },
                force: true
            });
        });

        test('should handle non-existent ID when hard deleting', async () => {
            PurchaseOrder.destroy.mockResolvedValueOnce(0);
            
            await purchaseOrderRepository.hardDelete(999);
            
            expect(PurchaseOrder.destroy).toHaveBeenCalledWith({ 
                where: { id: 999 },
                force: true
            });
        });
    });

    describe('restore', () => {
        beforeEach(() => {
            PurchaseOrder.findByPk = jest.fn();
        });

        test('should restore soft-deleted purchase order successfully', async () => {
            const mockPurchaseOrder = {
                id: 1,
                deleted_at: new Date(), 
                restore: jest.fn().mockResolvedValueOnce(true)
            };
            
            PurchaseOrder.findByPk.mockResolvedValueOnce(mockPurchaseOrder);
            
            const result = await purchaseOrderRepository.restore(1);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(1, { paranoid: false });
            expect(mockPurchaseOrder.restore).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        test('should return false when purchase order is not found', async () => {
            PurchaseOrder.findByPk.mockResolvedValueOnce(null);
            
            const result = await purchaseOrderRepository.restore(999);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(999, { paranoid: false });
            expect(result).toBe(false);
        });

        test('should return false when purchase order is not soft-deleted', async () => {

            const mockPurchaseOrder = {
                id: 1,
                deleted_at: null, 
                restore: jest.fn()
            };
            
            PurchaseOrder.findByPk.mockResolvedValueOnce(mockPurchaseOrder);
            
            const result = await purchaseOrderRepository.restore(1);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(1, { paranoid: false });
            expect(mockPurchaseOrder.restore).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        test('should throw error when restore operation fails', async () => {
            const mockError = new Error('Restore failed');
            const mockPurchaseOrder = {
                id: 1,
                deleted_at: new Date(),
                restore: jest.fn().mockRejectedValueOnce(mockError)
            };
            
            PurchaseOrder.findByPk.mockResolvedValueOnce(mockPurchaseOrder);
            
            await expect(purchaseOrderRepository.restore(1))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith(1, { paranoid: false });
            expect(mockPurchaseOrder.restore).toHaveBeenCalled();
        });

        test('should handle invalid ID type', async () => {
            const mockError = new Error('Invalid input');
            PurchaseOrder.findByPk.mockRejectedValueOnce(mockError);
            
            await expect(purchaseOrderRepository.restore('invalid-id'))
                .rejects.toThrow(mockError);
                
            expect(PurchaseOrder.findByPk).toHaveBeenCalledWith('invalid-id', { paranoid: false });
        });
    });


});
