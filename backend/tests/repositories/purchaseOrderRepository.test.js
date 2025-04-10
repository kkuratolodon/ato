const { PurchaseOrder } = require('../../src/models');
const PurchaseOrderRepository = require('../../src/repositories/purchaseOrderRepository');

// Mock the models
jest.mock('../../src/models', () => ({
    PurchaseOrder: {
        create: jest.fn(),
        findByPk: jest.fn(),
        update: jest.fn(),
        destroy: jest.fn()  // Added mock for destroy method
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

    describe('updateCustomerId', () => {
        test('should update customer_id successfully', async () => {
            await purchaseOrderRepository.updateCustomerId(1, 123);
            
            expect(PurchaseOrder.update).toHaveBeenCalledWith(
                { customer_id: 123 }, 
                { where: { id: 1 } }
            );
        });

        test('should throw an error when customer_id update fails', async () => {
            const mockError = new Error('Database error');
            PurchaseOrder.update.mockRejectedValue(mockError);
            
            await expect(purchaseOrderRepository.updateCustomerId(1, 123))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.update).toHaveBeenCalledWith(
                { customer_id: 123 }, 
                { where: { id: 1 } }
            );
        });
    });

    describe('updateVendorId', () => {
        test('should update vendor_id successfully', async () => {
            await purchaseOrderRepository.updateVendorId(1, 456);
            
            expect(PurchaseOrder.update).toHaveBeenCalledWith(
                { vendor_id: 456 }, 
                { where: { id: 1 } }
            );
        });

        test('should throw an error when vendor_id update fails', async () => {
            const mockError = new Error('Database error');
            PurchaseOrder.update.mockRejectedValue(mockError);
            
            await expect(purchaseOrderRepository.updateVendorId(1, 456))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.update).toHaveBeenCalledWith(
                { vendor_id: 456 }, 
                { where: { id: 1 } }
            );
        });
    });

    describe('delete', () => {
        test('should delete a purchase order successfully', async () => {
            PurchaseOrder.destroy.mockResolvedValue(1); // 1 record deleted
            
            const result = await purchaseOrderRepository.delete(1);
            
            expect(PurchaseOrder.destroy).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result).toBe(1);
        });

        test('should return 0 when no purchase order is deleted', async () => {
            PurchaseOrder.destroy.mockResolvedValue(0); // No records deleted
            
            const result = await purchaseOrderRepository.delete(999);
            
            expect(PurchaseOrder.destroy).toHaveBeenCalledWith({ where: { id: 999 } });
            expect(result).toBe(0);
        });

        test('should throw an error when delete operation fails', async () => {
            const mockError = new Error('Database error');
            PurchaseOrder.destroy.mockRejectedValue(mockError);
            
            await expect(purchaseOrderRepository.delete(1))
                .rejects.toThrow(mockError);
            
            expect(PurchaseOrder.destroy).toHaveBeenCalledWith({ where: { id: 1 } });
        });
    });
});
