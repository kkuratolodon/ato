const { DataTypes, Sequelize } = require('sequelize');
const ItemModel = require('../../src/models/item');
const InvoiceModel = require('../../src/models/invoice');
const PurchaseOrderModel = require('../../src/models/purchaseOrder');
// Hapus import FinancialDocumentItemModel karena sudah digabung ke Item
const PartnerModel = require('../../src/models/partner');
const CustomerModel = require('../../src/models/customer');
const VendorModel = require('../../src/models/vendor');
const { fail } = require('jest');

describe('Item Model', () => {
    let sequelize;
    let Item;
    let Invoice;
    let PurchaseOrder;
    // Hapus FinancialDocumentItem karena tidak digunakan lagi
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
        // Hapus inisialisasi FinancialDocumentItem
        Partner = PartnerModel(sequelize, DataTypes);
        Customer = CustomerModel(sequelize, DataTypes);
        Vendor = VendorModel(sequelize, DataTypes);

        // Setup associations
        Invoice.associate({ Partner, Customer, Vendor, Item });
        PurchaseOrder.associate({ Partner, Customer, Vendor, Item });
        Partner.associate?.({ Invoice, PurchaseOrder });
        Customer.associate && Customer.associate({ Invoice, PurchaseOrder });
        Vendor.associate && Vendor.associate({ Invoice, PurchaseOrder });
        Item.associate && Item.associate({ Invoice, PurchaseOrder });

        // Sync models to database
        await sequelize.sync({ force: true });
    });


    // Basic structure test
    test('it should have required item attributes', () => {
        expect(Item.rawAttributes).toHaveProperty('uuid');
        expect(Item.rawAttributes).toHaveProperty('description');
        // Tambahkan pengujian untuk atribut baru
        expect(Item.rawAttributes).toHaveProperty('document_id');
        expect(Item.rawAttributes).toHaveProperty('document_type');
        expect(Item.rawAttributes).toHaveProperty('quantity');
        expect(Item.rawAttributes).toHaveProperty('unit');
        expect(Item.rawAttributes).toHaveProperty('unit_price');
        expect(Item.rawAttributes).toHaveProperty('amount');
    });

    describe('Positive Cases', () => {
        test('should create an item with all fields populated', async () => {
            const item = await Item.create({
                description: 'Test item',
                document_id: 1,
                document_type: 'invoice',
                quantity: 5,
                unit: 'pcs',
                unit_price: 10.50,
                amount: 52.50
            });

            const retrievedItem = await Item.findByPk(item.uuid);

            expect(retrievedItem).toBeDefined();
            expect(retrievedItem.description).toBe('Test item');
            expect(retrievedItem.document_id).toBe(1);
            expect(retrievedItem.document_type).toBe('invoice');
            expect(retrievedItem.quantity).toBe(5);
            expect(retrievedItem.unit).toBe('pcs');
            expect(retrievedItem.unit_price).toBe(10.50);
            expect(retrievedItem.amount).toBe(52.50);
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
                unit_price: 99.99,
                amount: 999.99
            });

            const retrievedItem = await Item.findByPk(item.uuid);

            expect(retrievedItem).toBeDefined();
            expect(retrievedItem.description).toBe('Test item with decimals');
            expect(retrievedItem.unit_price).toBe(99.99);
            expect(retrievedItem.amount).toBe(999.99);
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

    // Update Associate Method Tests untuk relasi yang baru
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
            expect(LocalItem.associations.Invoice).toBeDefined();
            expect(LocalItem.associations.Invoice.associationType).toBe('BelongsTo');
            expect(LocalItem.associations.Invoice.options.foreignKey).toBe('document_id');
            expect(LocalItem.associations.Invoice.options.constraints).toBe(false);
            expect(LocalItem.associations.Invoice.options.scope.document_type).toBe('invoice');
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
            expect(LocalItem.associations.PurchaseOrder).toBeDefined();
            expect(LocalItem.associations.PurchaseOrder.associationType).toBe('BelongsTo');
            expect(LocalItem.associations.PurchaseOrder.options.foreignKey).toBe('document_id');
            expect(LocalItem.associations.PurchaseOrder.options.constraints).toBe(false);
            expect(LocalItem.associations.PurchaseOrder.options.scope.document_type).toBe('purchase_order');
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
            expect(LocalItem.associations.Invoice).toBeDefined();
            expect(LocalItem.associations.PurchaseOrder).toBeDefined();
        });
    });
});