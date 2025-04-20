const { PurchaseOrder } = require('@models/');
const PurchaseOrderRepository = require('@repositories/purchaseOrderRepository');

// Mock the models
jest.mock('@models/', () => ({
    PurchaseOrder: {
        create: jest.fn(),
        findByPk: jest.fn(),
        update: jest.fn()
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
});
