const ItemRepository = require('../../src/repositories/itemRepository');
const { Item } = require('../../src/models');

jest.mock('../../src/models', () => ({
    Item: {
        findOrCreate: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        findAll: jest.fn()
    },
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
            const itemData = {
                description: 'desc',
                quantity: 2,
                unit: 'pcs',
                unit_price: 100,
                amount: 200
            };
            await itemRepository.createDocumentItem(docType, docId, itemData);
            expect(Item.create).toHaveBeenCalledWith({
                uuid: 'mock-uuid',
                document_type: docType,
                document_id: docId,
                description: 'desc',
                quantity: 2,
                unit: 'pcs',
                unit_price: 100,
                amount: 200
            });
        });

        test('should handle undefined or null values in itemData', async () => {
            const docType = 'invoice';
            const docId = 'doc-123';
            const itemData = {
                description: undefined,
                quantity: undefined,
                unit: null,
                unit_price: undefined,
                amount: null
            };
            await itemRepository.createDocumentItem(docType, docId, itemData);
            expect(Item.create).toHaveBeenCalledWith({
                uuid: 'mock-uuid',
                document_type: docType,
                document_id: docId,
                description: undefined,
                quantity: undefined,
                unit: null,
                unit_price: undefined,
                amount: null
            });
        });

        // Negative case
        test('should throw error when create fails', async () => {
            Item.create.mockRejectedValue(new Error('Creation failed'));
            await expect(itemRepository.createDocumentItem('invoice', 'doc-123', {}))
                .rejects.toThrow('Creation failed');
        });
    });

    describe('findItemsByDocumentId', () => {
        // Positive case
        test('should return items for a document', async () => {
            const docItems = [
                {
                    uuid: 'item-1',
                    description: 'Test Item',
                    quantity: 2,
                    unit: 'pcs',
                    unit_price: 100,
                    amount: 200,
                    get: jest.fn().mockReturnValue({
                        uuid: 'item-1',
                        description: 'Test Item',
                        quantity: 2,
                        unit: 'pcs',
                        unit_price: 100,
                        amount: 200
                    })
                }
            ];
            Item.findAll.mockResolvedValue(docItems);
            const result = await itemRepository.findItemsByDocumentId('doc-123', 'invoice');
            expect(Item.findAll).toHaveBeenCalledWith({
                where: {
                    document_type: 'invoice',
                    document_id: 'doc-123'
                }
            });
            expect(result).toEqual([
                {
                    uuid: 'item-1',
                    description: 'Test Item',
                    quantity: 2,
                    unit: 'pcs',
                    unit_price: 100,
                    amount: 200
                }
            ]);
        });

        // Edge case
        test('should return empty array when no document items found', async () => {
            Item.findAll.mockResolvedValue([]);
            const result = await itemRepository.findItemsByDocumentId('nonexistent-doc', 'invoice');
            expect(result).toEqual([]);
        });

        // Negative case
        test('should throw error when findAll fails', async () => {
            Item.findAll.mockRejectedValue(new Error('Query failed'));
            await expect(itemRepository.findItemsByDocumentId('doc-123', 'invoice'))
                .rejects.toThrow('Query failed');
        });
    });
});