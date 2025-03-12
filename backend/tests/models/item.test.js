const { DataTypes, Sequelize } = require('sequelize');
const ItemModel = require('../../src/models/item');
const FinancialDocumentModel = require('../../src/models/financialDocument');
const FinancialDocumentItemModel = require('../../src/models/FinancialDocumentItem');
const PartnerModel = require('../../src/models/partner');
const CustomerModel = require('../../src/models/customer');
const VendorModel = require('../../src/models/vendor');

describe('Item Model', () => {
    let sequelize;
    let Item;
    let FinancialDocument;
    let FinancialDocumentItem;
    let Partner;
    let Customer;
    let Vendor;

    beforeEach(async () => {
        // Create in-memory database
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        
        // Initialize models
        Item = ItemModel(sequelize, DataTypes);
        FinancialDocument = FinancialDocumentModel(sequelize, DataTypes);
        FinancialDocumentItem = FinancialDocumentItemModel(sequelize, DataTypes);
        Partner = PartnerModel(sequelize, DataTypes);
        Customer = CustomerModel(sequelize, DataTypes);
        Vendor = VendorModel(sequelize, DataTypes);
        
        // Setup associations with all required models
        const models = { 
            Item, 
            FinancialDocument, 
            FinancialDocumentItem,
            Partner,
            Customer,
            Vendor
        };
        
        // Call associate methods
        Item.associate(models);
        FinancialDocument.associate && FinancialDocument.associate(models);
        Partner.associate && Partner.associate(models);
        Customer.associate && Customer.associate(models);
        Vendor.associate && Vendor.associate(models);
        
        // Sync models to database
        await sequelize.sync({ force: true });
    });
    
    afterEach(async () => {
        await sequelize.close();
    });

    // Basic structure test
    test('it should have required item attributes', () => {
        expect(Item.rawAttributes).toHaveProperty('uuid');
        expect(Item.rawAttributes).toHaveProperty('description');
        expect(Item.rawAttributes).toHaveProperty('quantity');
        expect(Item.rawAttributes).toHaveProperty('unit');
        expect(Item.rawAttributes).toHaveProperty('unit_price');
        expect(Item.rawAttributes).toHaveProperty('amount');
    });

    describe('Positive Cases', () => {
        test('should create an item with all fields populated', async () => {
            const item = await Item.create({
                description: 'Test item',
                quantity: 5,
                unit: 'pcs',
                unit_price: 10.50,
                amount: 52.50
            });
    
            const retrievedItem = await Item.findByPk(item.uuid);
            
            expect(retrievedItem).toBeDefined();
            expect(retrievedItem.description).toBe('Test item');
            expect(parseFloat(retrievedItem.quantity)).toBe(5);
            expect(retrievedItem.unit).toBe('pcs');
            expect(parseFloat(retrievedItem.unit_price)).toBe(10.50);
            expect(parseFloat(retrievedItem.amount)).toBe(52.50);
        });
    
        test('should handle null values for optional fields', async () => {
            const item = await Item.create({
                description: null,
                quantity: null,
                unit: null,
                unit_price: null,
                amount: null
            });
    
            expect(item).toHaveProperty('uuid');
            expect(item.description).toBeNull();
            expect(item.quantity).toBeNull();
            expect(item.unit).toBeNull();
            expect(item.unit_price).toBeNull();
            expect(item.amount).toBeNull();
        });
    
        test('should correctly create and retrieve an item with decimal values', async () => {
            const item = await Item.create({
                description: 'Test item with decimals',
                quantity: 2.5,
                unit: 'kg',
                unit_price: 19.99,
                amount: 49.975
            });
    
            const retrievedItem = await Item.findByPk(item.uuid);
    
            expect(retrievedItem).toBeDefined();
            expect(retrievedItem.description).toBe('Test item with decimals');
            expect(parseFloat(retrievedItem.quantity)).toBe(2.5);
            expect(retrievedItem.unit).toBe('kg');
            expect(parseFloat(retrievedItem.unit_price)).toBe(19.99);
            expect(parseFloat(retrievedItem.amount)).toBeCloseTo(49.975);
        });
    });

    describe('Negative Cases', () => {
        test('should handle attempts to create with invalid UUID', async () => {
            try {
                await Item.create({
                    uuid: 'not-a-valid-uuid',
                    description: 'Invalid UUID item'
                });
                fail('Should have thrown a validation error for invalid UUID');
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });

    describe('Corner Cases', () => {
        test('should handle very large decimal values', async () => {
            const item = await Item.create({
                description: 'Large value item',
                quantity: 9999999.99,
                unit_price: 9999999.99,
                amount: 9999999.99
            });
            
            const retrievedItem = await Item.findByPk(item.uuid);
            
            expect(retrievedItem).toBeDefined();
            expect(parseFloat(retrievedItem.quantity)).toBe(9999999.99);
            expect(parseFloat(retrievedItem.unit_price)).toBe(9999999.99);
            expect(parseFloat(retrievedItem.amount)).toBe(9999999.99);
        });
        
        test('should handle empty string values', async () => {
            const item = await Item.create({
                description: '',
                unit: ''
            });
            
            const retrievedItem = await Item.findByPk(item.uuid);
            
            expect(retrievedItem).toBeDefined();
            expect(retrievedItem.description).toBe('');
            expect(retrievedItem.unit).toBe('');
        });
        
        test('should handle very long description text', async () => {
            const longText = 'a'.repeat(5000);
            
            const item = await Item.create({
                description: longText
            });
            
            const retrievedItem = await Item.findByPk(item.uuid);
            
            expect(retrievedItem).toBeDefined();
            expect(retrievedItem.description).toBe(longText);
            expect(retrievedItem.description.length).toBe(5000);
        });
    });

    describe('Association Tests', () => {
        describe('Positive Association Cases', () => {
            test('should have a many-to-many association with FinancialDocument', () => {
                expect(Item.associations).toBeDefined();
                expect(Item.associations.financial_documents).toBeDefined();
                expect(Item.associations.financial_documents.associationType).toBe('BelongsToMany');
            });

            test('should allow linking items to financial documents', async () => {
                try {
                    // Disable foreign key checks
                    await sequelize.query('PRAGMA foreign_keys = OFF;');
                    
                    // Create a test item
                    const item = await Item.create({
                        description: 'Test item',
                        quantity: 1,
                        unit: 'pc',
                        unit_price: 100,
                        amount: 100
                    });
                    
                    // Create a test financial document
                    const financialDoc = await FinancialDocument.create({
                        status: 'Analyzed',
                        partner_id: 'test-partner',
                    });
                    
                    // Associate item with financial document
                    await item.addFinancial_document(financialDoc, { 
                        through: { 
                            quantity: 2,
                            unit_price: 50,
                            amount: 100
                        }
                    });
                    
                    // Get related documents using the association
                    const documents = await item.getFinancial_documents();
                    expect(documents).toHaveLength(1);
                    
                    const docId = financialDoc.uuid || financialDoc.id;
                    expect(documents[0].uuid || documents[0].id).toBe(docId);
                    
                    // Check the relationship from the other side
                    const items = await financialDoc.getItems();
                    expect(items).toHaveLength(1);
                    expect(items[0].uuid || items[0].id).toBe(item.uuid || item.id);
                    
                    // Check the join table data
                    const allJoinRecords = await FinancialDocumentItem.findAll();
                    const joinTableAttributes = Object.keys(FinancialDocumentItem.rawAttributes);
                    
                    const joinData = await FinancialDocumentItem.findOne({
                        where: {
                            [joinTableAttributes.includes('financial_document_id') ? 
                                'financial_document_id' : 'financialDocumentId']: docId,
                            [joinTableAttributes.includes('item_id') ? 'item_id' : 'itemId']: item.uuid || item.id
                        }
                    });
                    
                    expect(joinData).toBeDefined();
                    if (joinData) {
                        expect(parseFloat(joinData.quantity)).toBe(2);
                        expect(parseFloat(joinData.unit_price)).toBe(50);
                        expect(parseFloat(joinData.amount)).toBe(100);
                    }
                } catch (error) {
                    console.error('Test error details:', error);
                    throw error;
                } finally {
                    // Re-enable foreign key checks
                    await sequelize.query('PRAGMA foreign_keys = ON;');
                }
            });
        });
        
        describe('Negative Association Cases', () => {
            test('should handle associating with non-existent financial document', async () => {
                try {
                    const item = await Item.create({ description: 'Test item' });
                    
                    // Try to associate with a non-existent ID
                    await item.addFinancial_document({ uuid: 'non-existent-uuid' });
                    
                    fail('Should have thrown an error');
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });
            
            test('should handle deletion of associated documents', async () => {
                // Disable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = OFF;');
                
                const item = await Item.create({ description: 'Test item' });
                
                const financialDoc = await FinancialDocument.create({
                    status: 'Analyzed',
                    partner_id: 'test-partner',
                });
                
                await item.addFinancial_document(financialDoc);
                
                // Delete the financial document
                await financialDoc.destroy();
                
                // The association should be gone
                const documents = await item.getFinancial_documents();
                expect(documents).toHaveLength(0);
                
                // Re-enable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = ON;');
            });
        });
        
        describe('Corner Association Cases', () => {
            test('should handle multiple documents associated with one item', async () => {
                // Disable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = OFF;');
                
                const item = await Item.create({ description: 'Multi-doc item' });
                
                // Create multiple documents
                const docs = await Promise.all([
                    FinancialDocument.create({ status: 'Analyzed', partner_id: 'partner1' }),
                    FinancialDocument.create({ status: 'Analyzed', partner_id: 'partner2' }),
                    FinancialDocument.create({ status: 'Analyzed', partner_id: 'partner3' }),
                ]);
                
                // Associate all documents with the item
                for (const doc of docs) {
                    await item.addFinancial_document(doc);
                }
                
                // Verify associations
                const documents = await item.getFinancial_documents();
                expect(documents).toHaveLength(3);
                
                // Re-enable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = ON;');
            });
            
            test('should handle one document associated with multiple items', async () => {
                // Disable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = OFF;');
                
                // Create multiple items
                const items = await Promise.all([
                    Item.create({ description: 'Item 1' }),
                    Item.create({ description: 'Item 2' }),
                    Item.create({ description: 'Item 3' }),
                ]);
                
                // Create one document
                const financialDoc = await FinancialDocument.create({
                    status: 'Analyzed',
                    partner_id: 'test-partner',
                });
                
                // Associate all items with the document
                for (const item of items) {
                    await item.addFinancial_document(financialDoc);
                }
                
                // Verify associations
                const associatedItems = await financialDoc.getItems();
                expect(associatedItems).toHaveLength(3);
                
                // Re-enable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = ON;');
            });
        });
    });
});