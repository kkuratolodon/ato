const ItemRepository = require('../../src/repositories/itemRepository');
const { Item, FinancialDocumentItem } = require('../../src/models');

jest.mock('../../src/models', () => ({
    Item: {
        findOrCreate: jest.fn(),
        findByPk: jest.fn()
    },
    FinancialDocumentItem: {
        create: jest.fn(),
        findAll: jest.fn()
    }
}));

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mock-uuid')
}));

describe('ItemRepository', () => {
    let itemRepository;

    beforeEach(() => {
        itemRepository = new ItemRepository();
        jest.clearAllMocks();
    });

    describe('findOrCreateItem', () => {
        // Positive case
        test('should return existing item when item with description exists', async () => {
            const mockItem = {
                uuid: 'existing-uuid',
                description: 'Test Item',
                get: jest.fn().mockReturnValue({ uuid: 'existing-uuid', description: 'Test Item' })
            };
            
            Item.findOrCreate.mockResolvedValue([mockItem, false]);
            
            const result = await itemRepository.findOrCreateItem('Test Item');
            
            expect(Item.findOrCreate).toHaveBeenCalledWith({
                where: { description: 'Test Item' },
                defaults: {
                    uuid: 'mock-uuid',
                    description: 'Test Item'
                }
            });
            expect(result).toEqual({ uuid: 'existing-uuid', description: 'Test Item' });
        });

        // Positive case
        test('should create and return new item when item with description does not exist', async () => {
            const mockItem = {
                uuid: 'mock-uuid',
                description: 'New Item',
                get: jest.fn().mockReturnValue({ uuid: 'mock-uuid', description: 'New Item' })
            };
            
            Item.findOrCreate.mockResolvedValue([mockItem, true]);
            
            const result = await itemRepository.findOrCreateItem('New Item');
            
            expect(Item.findOrCreate).toHaveBeenCalledWith({
                where: { description: 'New Item' },
                defaults: {
                    uuid: 'mock-uuid',
                    description: 'New Item'
                }
            });
            expect(result).toEqual({ uuid: 'mock-uuid', description: 'New Item' });
        });

        // Negative case
        test('should throw error when findOrCreate fails', async () => {
            Item.findOrCreate.mockRejectedValue(new Error('Database error'));
            
            await expect(itemRepository.findOrCreateItem('Test Item')).rejects.toThrow('Database error');
        });
    });

    describe('createDocumentItem', () => {
        // Positive case
        test('should create a document item successfully', async () => {
            const docType = 'invoice';
            const docId = 'doc-123';
            const itemId = 'item-456';
            const itemData = {
                quantity: 2,
                unit: 'pcs',
                unit_price: 100,
                amount: 200
            };
            
            await itemRepository.createDocumentItem(docType, docId, itemId, itemData);
            
            expect(FinancialDocumentItem.create).toHaveBeenCalledWith({
                id: 'mock-uuid',
                document_type: docType,
                document_id: docId,
                item_id: itemId,
                quantity: itemData.quantity,
                unit: itemData.unit,
                unit_price: itemData.unit_price,
                amount: itemData.amount
            });
        });

        test('should handle undefined or null values in itemData', async () => {
            const docType = 'invoice';
            const docId = 'doc-123';
            const itemId = 'item-456';
            
            // Test with undefined values
            const itemData = {
                quantity: undefined,
                unit: null,
                unit_price: undefined,
                amount: null
            };
            
            await itemRepository.createDocumentItem(docType, docId, itemId, itemData);
            
            expect(FinancialDocumentItem.create).toHaveBeenCalledWith({
                id: 'mock-uuid',
                document_type: docType,
                document_id: docId,
                item_id: itemId,
                quantity: undefined,
                unit: null,
                unit_price: undefined,
                amount: null
            });
        });

        // Negative case
        test('should throw error when create fails', async () => {
            FinancialDocumentItem.create.mockRejectedValue(new Error('Creation failed'));
            
            await expect(itemRepository.createDocumentItem('invoice', 'doc-123', 'item-456', {}))
                .rejects.toThrow('Creation failed');
        });
    });

    describe('findItemsByDocumentId', () => {
        // Positive case
        test('should return items for a document', async () => {
            const docItems = [
                {
                    item_id: 'item-1',
                    quantity: 2,
                    unit: 'pcs',
                    unit_price: 100,
                    amount: 200,
                    get: jest.fn().mockReturnValue({
                        item_id: 'item-1',
                        quantity: 2,
                        unit: 'pcs',
                        unit_price: 100,
                        amount: 200
                    })
                }
            ];
            
            const itemDetails = {
                description: 'Test Item',
                get: jest.fn().mockReturnValue({ description: 'Test Item' })
            };
            
            FinancialDocumentItem.findAll.mockResolvedValue(docItems);
            Item.findByPk.mockResolvedValue(itemDetails);
            
            const result = await itemRepository.findItemsByDocumentId('doc-123', 'invoice');
            
            expect(FinancialDocumentItem.findAll).toHaveBeenCalledWith({
                where: {
                    document_type: 'invoice',
                    document_id: 'doc-123'
                }
            });
            
            expect(Item.findByPk).toHaveBeenCalledWith('item-1');
            expect(result).toEqual([{
                amount: 200,
                description: 'Test Item',
                quantity: 2,
                unit: 'pcs',
                unit_price: 100
            }]);
        });

        // Edge case
        test('should return empty array when no document items found', async () => {
            FinancialDocumentItem.findAll.mockResolvedValue([]);
            
            const result = await itemRepository.findItemsByDocumentId('nonexistent-doc', 'invoice');
            
            expect(result).toEqual([]);
            expect(Item.findByPk).not.toHaveBeenCalled();
        });

        // Edge case
        test('should skip items when item details not found', async () => {
            const docItems = [
                {
                    item_id: 'item-1',
                    quantity: 2,
                    unit: 'pcs',
                    unit_price: 100,
                    amount: 200,
                    get: jest.fn().mockReturnValue({
                        item_id: 'item-1',
                        quantity: 2,
                        unit: 'pcs',
                        unit_price: 100,
                        amount: 200
                    })
                }
            ];
            
            FinancialDocumentItem.findAll.mockResolvedValue(docItems);
            Item.findByPk.mockResolvedValue(null);
            
            const result = await itemRepository.findItemsByDocumentId('doc-123', 'invoice');
            
            expect(result).toEqual([]);
        });

        
        test('should handle null description in item details', async () => {
            // Setup document item
            const docItems = [
                {
                    item_id: 'item-1',
                    quantity: 2,
                    unit: 'pcs',
                    unit_price: 100,
                    amount: 200,
                    get: jest.fn().mockReturnValue({
                        item_id: 'item-1',
                        quantity: 2,
                        unit: 'pcs',
                        unit_price: 100,
                        amount: 200
                    })
                }
            ];
            
            // Setup item with undefined description
            const itemDetails = {
                description: undefined, // This will trigger the || null fallback
                get: jest.fn().mockReturnValue({ description: undefined })
            };
            
            FinancialDocumentItem.findAll.mockResolvedValue(docItems);
            Item.findByPk.mockResolvedValue(itemDetails);
            
            const result = await itemRepository.findItemsByDocumentId('doc-123', 'invoice');
            
            expect(FinancialDocumentItem.findAll).toHaveBeenCalledWith({
                where: {
                    document_type: 'invoice',
                    document_id: 'doc-123'
                }
            });
            
            expect(Item.findByPk).toHaveBeenCalledWith('item-1');
            
            // The important part - checking that description is null
            expect(result).toEqual([{
                amount: 200,
                description: null, // This should be null because of the fallback
                quantity: 2,
                unit: 'pcs',
                unit_price: 100
            }]);
        });
    

        // Negative case
        test('should throw error when findAll fails', async () => {
            FinancialDocumentItem.findAll.mockRejectedValue(new Error('Query failed'));
            
            await expect(itemRepository.findItemsByDocumentId('doc-123', 'invoice'))
                .rejects.toThrow('Query failed');
        });

    });
});