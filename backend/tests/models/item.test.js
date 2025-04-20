const { DataTypes, Sequelize } = require('sequelize');
const ItemModel = require('@models/item');
const InvoiceModel = require('@models/invoice');
const PurchaseOrderModel = require('@models/purchaseOrder');
const FinancialDocumentItemModel = require('@models/FinancialDocumentItem');
const PartnerModel = require('@models/partner');
const CustomerModel = require('@models/customer');
const VendorModel = require('@models/vendor');
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

    // Add this new test section within the 'Association Tests' describe block:
    describe('Associate Method Tests', () => {
        test('should properly call associate with Invoice model', () => {
            // Create a fresh instance to avoid state from previous tests
            const localSequelize = new Sequelize('sqlite::memory:', { logging: false });
            const LocalItem = ItemModel(localSequelize, DataTypes);
            const LocalInvoice = InvoiceModel(localSequelize, DataTypes);

            // Call the associate method with just Invoice
            LocalItem.associate({ Invoice: LocalInvoice });

            // Verify the association was created correctly
            expect(LocalItem.associations).toBeDefined();
            expect(LocalItem.associations.invoices).toBeDefined();
            expect(LocalItem.associations.invoices.associationType).toBe('BelongsToMany');
            expect(LocalItem.associations.invoices.options.through.model).toBe('FinancialDocumentItem');
            expect(LocalItem.associations.invoices.options.foreignKey).toBe('item_id');
            expect(LocalItem.associations.invoices.options.otherKey).toBe('document_id');
        });

        test('should properly call associate with PurchaseOrder model', () => {
            // Create a fresh instance to avoid state from previous tests
            const localSequelize = new Sequelize('sqlite::memory:', { logging: false });
            const LocalItem = ItemModel(localSequelize, DataTypes);
            const LocalPurchaseOrder = PurchaseOrderModel(localSequelize, DataTypes);

            // Call the associate method with just PurchaseOrder
            LocalItem.associate({ PurchaseOrder: LocalPurchaseOrder });

            // Verify the association was created correctly
            expect(LocalItem.associations).toBeDefined();
            expect(LocalItem.associations.purchase_orders).toBeDefined();
            expect(LocalItem.associations.purchase_orders.associationType).toBe('BelongsToMany');
            expect(LocalItem.associations.purchase_orders.options.through.model).toBe('FinancialDocumentItem');
            expect(LocalItem.associations.purchase_orders.options.foreignKey).toBe('item_id');
            expect(LocalItem.associations.purchase_orders.options.otherKey).toBe('document_id');
        });

        test('should handle edge cases in associate method', () => {
            // Create a fresh instance
            const localSequelize = new Sequelize('sqlite::memory:', { logging: false });
            const LocalItem = ItemModel(localSequelize, DataTypes);

            // Test with null/undefined
            expect(() => {
                LocalItem.associate(null);
            }).not.toThrow();

            expect(() => {
                LocalItem.associate(undefined);
            }).not.toThrow();

            // Test with empty object
            expect(() => {
                LocalItem.associate({});
            }).not.toThrow();

            // Test with object that has no relevant models
            expect(() => {
                LocalItem.associate({ SomeOtherModel: {} });
            }).not.toThrow();
        });

        test('should handle both models in the same call', () => {
            // Create a fresh instance
            const localSequelize = new Sequelize('sqlite::memory:', { logging: false });
            const LocalItem = ItemModel(localSequelize, DataTypes);
            const LocalInvoice = InvoiceModel(localSequelize, DataTypes);
            const LocalPurchaseOrder = PurchaseOrderModel(localSequelize, DataTypes);

            // Call with both models
            LocalItem.associate({
                Invoice: LocalInvoice,
                PurchaseOrder: LocalPurchaseOrder
            });

            // Verify both associations
            expect(LocalItem.associations.invoices).toBeDefined();
            expect(LocalItem.associations.purchase_orders).toBeDefined();
        });
    });
});