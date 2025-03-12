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
    describe('Association Tests', () => {
        test('should have a many-to-many association with FinancialDocument', () => {
            expect(Item.associations).toBeDefined();
            expect(Item.associations.financial_documents).toBeDefined();
            expect(Item.associations.financial_documents.associationType).toBe('BelongsToMany');
            expect(Item.associations.financial_documents.through.model).toBe(FinancialDocumentItem);
        });
    });
});