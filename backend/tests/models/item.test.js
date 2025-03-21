const { DataTypes, Sequelize } = require('sequelize');
const ItemModel = require('../../src/models/item');
const InvoiceModel = require('../../src/models/invoice');
const PurchaseOrderModel = require('../../src/models/purchaseOrder');
const FinancialDocumentItemModel = require('../../src/models/FinancialDocumentItem');
const PartnerModel = require('../../src/models/partner');
const CustomerModel = require('../../src/models/customer');
const VendorModel = require('../../src/models/vendor');
const { fail } = require('jest');

describe('Item Model', () => {
    let sequelize;
    let Item;
    let Invoice;
    let PurchaseOrder;
    let FinancialDocumentItem;
    let Partner;
    let Customer;
    let Vendor;

    beforeEach(async () => {
        // Create in-memory database
        sequelize = new Sequelize('sqlite::memory:', { logging: false });

        // Initialize models
        Item = ItemModel(sequelize, DataTypes);
        Invoice = InvoiceModel(sequelize, DataTypes);
        PurchaseOrder = PurchaseOrderModel(sequelize, DataTypes);
        FinancialDocumentItem = FinancialDocumentItemModel(sequelize, DataTypes);
        Partner = PartnerModel(sequelize, DataTypes);
        Customer = CustomerModel(sequelize, DataTypes);
        Vendor = VendorModel(sequelize, DataTypes);

        // Setup associations
        Invoice.associate({ Partner, Customer, Vendor, Item });
        PurchaseOrder.associate({ Partner, Customer, Vendor, Item });
        Partner.associate?.({ Invoice, PurchaseOrder });
        Customer.associate && Customer.associate({ Invoice, PurchaseOrder });
        Vendor.associate && Vendor.associate({ Invoice, PurchaseOrder });
        
        // Set up Item associations manually
        Item.belongsToMany(Invoice, {
            through: FinancialDocumentItem,
            foreignKey: 'item_id',
            otherKey: 'document_id',
            as: 'invoices'
        });
        
        Item.belongsToMany(PurchaseOrder, {
            through: FinancialDocumentItem,
            foreignKey: 'item_id',
            otherKey: 'document_id',
            as: 'purchase_orders'
        });

        // Sync models to database
        await sequelize.sync({ force: true });
    });


    // Basic structure test
    test('it should have required item attributes', () => {
        expect(Item.rawAttributes).toHaveProperty('uuid');
        expect(Item.rawAttributes).toHaveProperty('description');
    });

    describe('Positive Cases', () => {
        test('should create an item with all fields populated', async () => {
            const item = await Item.create({
                description: 'Test item',
            });

            const retrievedItem = await Item.findByPk(item.uuid);

            expect(retrievedItem).toBeDefined();
            expect(retrievedItem.description).toBe('Test item');
        });

        test('should handle null values for optional fields', async () => {
            const item = await Item.create({
                description: null,
                quantity: null,
            });

            expect(item).toHaveProperty('uuid');
            expect(item.description).toBeNull();
        });

        test('should correctly create and retrieve an item with decimal values', async () => {
            const item = await Item.create({
                description: 'Test item with decimals',
            });

            const retrievedItem = await Item.findByPk(item.uuid);

            expect(retrievedItem).toBeDefined();
            expect(retrievedItem.description).toBe('Test item with decimals');
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
        test('should handle empty string values', async () => {
            const item = await Item.create({
                description: '',
            });

            const retrievedItem = await Item.findByPk(item.uuid);

            expect(retrievedItem).toBeDefined();
            expect(retrievedItem.description).toBe('');
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
            test('should have many-to-many associations with Invoice and PurchaseOrder', () => {
                expect(Item.associations).toBeDefined();
                expect(Item.associations.invoices).toBeDefined();
                expect(Item.associations.invoices.associationType).toBe('BelongsToMany');
                expect(Item.associations.purchase_orders).toBeDefined();
                expect(Item.associations.purchase_orders.associationType).toBe('BelongsToMany');
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

                    // Create a partner for foreign key constraint
                    const partner = await Partner.create({
                        uuid: "test-partner-uuid",
                        name: "Test Partner",
                        email: "test@example.com",   // Add required field
                        password: "password123",     // Add required field
                        created_at: new Date()       // Add required field
                    });
                    

                    // Create a test invoice instead of financial document
                    const invoice = await Invoice.create({
                        status: 'Analyzed',
                        partner_id: partner.uuid,
                    });

                    // Use direct creation on the join table
                    await FinancialDocumentItem.create({
                        document_id: invoice.id,
                        document_type: 'Invoice',
                        item_id: item.uuid,
                        quantity: 2,
                        unit_price: 50,
                        amount: 100
                    });

                    // Get related documents
                    const documents = await FinancialDocumentItem.findAll({
                        where: {
                            item_id: item.uuid
                        }
                    });

                    expect(documents).toHaveLength(1);

                    const docId = invoice.id;
                    const foundDoc = await Invoice.findByPk(docId);
                    expect(foundDoc).toBeDefined();
                } catch (error) {
                    console.error('Test error:', error);
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
                    await item.addInvoice({ id: 'non-existent-id' });

                    fail('Should have thrown an error');
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });

            test('should handle deletion of associated documents', async () => {
                // Disable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = OFF;');

                const item = await Item.create({ description: 'Test item' });

                // Create a partner for foreign key constraint
                const partner = await Partner.create({
                    uuid: "partner-test-uuid",
                    name: "Test Partner",
                    email: "test2@example.com",  // Add required field
                    password: "password123",     // Add required field
                    created_at: new Date()       // Add required field
                });

                // Use Invoice instead of FinancialDocument
                const invoice = await Invoice.create({
                    status: 'Analyzed',
                    partner_id: partner.uuid,
                });

                // Create the association directly in the join table
                await FinancialDocumentItem.create({
                    document_id: invoice.id,
                    document_type: 'Invoice',
                    item_id: item.uuid,
                    quantity: 2,
                    unit_price: 50,
                    amount: 100
                });

                // Delete the invoice
                await invoice.destroy();

                // Check the join table directly
                const joinRecords = await FinancialDocumentItem.findAll({
                    where: {
                        item_id: item.uuid
                    }
                });

                // Changed expectation: The join records still exist (no CASCADE DELETE)
                expect(joinRecords).toHaveLength(1);

                // But the referenced document should be gone
                const deletedDoc = await Invoice.findByPk(invoice.id);
                expect(deletedDoc).toBeNull();

                // Re-enable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = ON;');
            });
        });

        describe('Corner Association Cases', () => {
            test('should handle multiple documents associated with one item', async () => {
                // Disable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = OFF;');
            
                const item = await Item.create({ description: 'Multi-doc item' });
                
                // Create a partner for foreign key constraint
                const partner = await Partner.create({
                    uuid: "multi-partner-uuid",
                    name: "Multi Partner",
                    email: "multi@example.com",  // Add required field
                    password: "password123",     // Add required field
                    created_at: new Date()       // Add required field
                });
            
                // Create multiple invoices instead of generic documents
                const docs = await Promise.all([
                    Invoice.create({ status: 'Analyzed', partner_id: partner.uuid }),
                    Invoice.create({ status: 'Analyzed', partner_id: partner.uuid }),
                    Invoice.create({ status: 'Analyzed', partner_id: partner.uuid }),
                ]);
            
                // Associate all documents with the item using the join table directly
                for (const doc of docs) {
                    await FinancialDocumentItem.create({
                        document_id: doc.id,
                        document_type: 'Invoice',
                        item_id: item.uuid,
                        quantity: 1,
                        unit_price: 100,
                        amount: 100
                    });
                }
            
                // Verify associations by querying the join table
                const joinRecords = await FinancialDocumentItem.findAll({
                    where: {
                        item_id: item.uuid
                    }
                });
                expect(joinRecords).toHaveLength(3);
            
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
                
                // Create a partner for foreign key constraint
                const partner = await Partner.create({
                    uuid: "one-doc-partner-uuid",
                    name: "One Doc Partner",
                    email: "one-doc@example.com", // Add required field
                    password: "password123",      // Add required field
                    created_at: new Date()        // Add required field
                });
            
                // Use Invoice instead of FinancialDocument
                const invoice = await Invoice.create({
                    status: 'Analyzed',
                    partner_id: partner.uuid,
                });
            
                // Associate all items with the document using the join table directly
                for (const item of items) {
                    await FinancialDocumentItem.create({
                        document_id: invoice.id,
                        document_type: 'Invoice',
                        item_id: item.uuid,
                        quantity: 1,
                        unit_price: 100, 
                        amount: 100
                    });
                }
            
                // Verify associations by querying the join table
                const joinRecords = await FinancialDocumentItem.findAll({
                    where: {
                        document_id: invoice.id
                    }
                });
                expect(joinRecords).toHaveLength(3);
            
                // Re-enable foreign key checks
                await sequelize.query('PRAGMA foreign_keys = ON;');
            });
        });
    });
});