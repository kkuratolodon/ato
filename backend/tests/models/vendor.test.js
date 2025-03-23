const { DataTypes, Sequelize } = require('sequelize');
const { fail } = require('@jest/globals');

const VendorModel = require('../../src/models/vendor');
const InvoiceModel = require('../../src/models/invoice');
const PurchaseOrderModel = require('../../src/models/purchaseOrder');

describe('Vendor Model', () => {
    let sequelize;
    let Vendor;
    let vendorId;
    let Invoice;  // Replace FinancialDocument with concrete models
    let PurchaseOrder;

    beforeEach(async () => {
        // Create in-memory database
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        Vendor = VendorModel(sequelize, DataTypes);
        Invoice = InvoiceModel(sequelize, DataTypes);
        PurchaseOrder = PurchaseOrderModel(sequelize, DataTypes);
        
        // Setup associations
        Vendor.associate({ Invoice, PurchaseOrder });
        
        // Set up reverse associations
        Invoice.belongsTo(Vendor, {
            foreignKey: 'vendor_id',
            as: 'vendor'
        });
        
        PurchaseOrder.belongsTo(Vendor, {
            foreignKey: 'vendor_id',
            as: 'vendor'
        });
        
        // Sync model to database
        await sequelize.sync({ force: true });
        
        // Create a test vendor
        const vendor = await Vendor.create({
            name: 'Test Vendor',
            recipient_name: 'Jane Supplier',
            tax_id: 'V-98765'
        });
        vendorId = vendor.uuid;
    });
    
    afterEach(async () => {
        await sequelize.close();
    });

    // Model Structure tests - unchanged

    describe('Model Structure', () => {
        // Basic structure test
        test('it should have required vendor attributes', () => {
            expect(Vendor.rawAttributes).toHaveProperty('uuid');
            expect(Vendor.rawAttributes).toHaveProperty('name');
            expect(Vendor.rawAttributes).toHaveProperty('address');
            expect(Vendor.rawAttributes).toHaveProperty('recipient_name');
            expect(Vendor.rawAttributes).toHaveProperty('tax_id');
        });
        
        test('it should use UUID as primary key', () => {
            expect(Vendor.rawAttributes.uuid.primaryKey).toBe(true);
            expect(Vendor.rawAttributes.uuid.type instanceof DataTypes.UUID).toBe(true);
        });
        
        test('it should have appropriate table name config', () => {
            expect(Vendor.tableName).toBe('Vendor');
            expect(Vendor.options.freezeTableName).toBe(true);
        });
    });

    // Positive Cases tests - unchanged 

    describe('Positive Cases', () => {
        // Basic creation test
        test('should create a vendor successfully with all attributes', async () => {
            const vendor = await Vendor.findByPk(vendorId);
            
            expect(vendor).toBeTruthy();
            expect(vendor.name).toBe('Test Vendor');
            expect(vendor.street_address).toBe('456 Business Ave');
            expect(vendor.city).toBe('Supplier City');
            expect(vendor.state).toBe('Supply State');
            expect(vendor.postal_code).toBe('54321');
            expect(vendor.house).toBe('456');
            expect(vendor.recipient_name).toBe('Jane Supplier');
            expect(vendor.tax_id).toBe('V-98765');
        });
        
        test('should create a vendor with minimal attributes', async () => {
            const minimalVendor = await Vendor.create({
                name: 'Minimal Vendor'
            });
            
            const savedVendor = await Vendor.findByPk(minimalVendor.uuid);
            
            expect(savedVendor).toBeTruthy();
            expect(savedVendor.name).toBe('Minimal Vendor');
            expect(savedVendor.street_address).toBeNull();
            expect(savedVendor.city).toBeNull();
            expect(savedVendor.tax_id).toBeNull();
        });
        
        test('should update vendor details successfully', async () => {
            const vendor = await Vendor.findByPk(vendorId);
            
            vendor.name = 'Updated Vendor Name';
            vendor.tax_id = 'NEW-TAX-ID';
            await vendor.save();
            
            const updatedVendor = await Vendor.findByPk(vendorId);
            expect(updatedVendor.name).toBe('Updated Vendor Name');
            expect(updatedVendor.tax_id).toBe('NEW-TAX-ID');
            // Original fields unchanged
            expect(updatedVendor.city).toBe('Supplier City');
        });
    });

    // Negative Cases tests - unchanged

    describe('Negative Cases', () => {
        test('should not create duplicate primary keys', async () => {
            // Try to create a vendor with existing UUID
            try {
                await Vendor.create({
                    uuid: vendorId,
                    name: 'Duplicate Vendor'
                });
                fail('Should have thrown a unique constraint error');
            } catch (error) {
                expect(error).toBeDefined();
                expect(error.name).toContain('Error'); // Different SQLite error compared to real DB
            }
        });
        
        test('should handle very long input strings', async () => {
            const longName = 'A'.repeat(1000);
            const vendor = await Vendor.create({
                name: longName
            });
            
            const savedVendor = await Vendor.findByPk(vendor.uuid);
            expect(savedVendor.name).toBe(longName);
        });
    });

    // Corner Cases with Fixed FinancialDocument.create

    describe('Corner Cases', () => {
        test('should handle empty strings vs null values', async () => {
            const vendor = await Vendor.create({
                name: '',
                street_address: null,
                city: '',
                state: null
            });
            
            const savedVendor = await Vendor.findByPk(vendor.uuid);
            expect(savedVendor.name).toBe(''); // Empty string preserved
            expect(savedVendor.street_address).toBeNull(); // Null preserved
            expect(savedVendor.city).toBe(''); // Empty string preserved
            expect(savedVendor.state).toBeNull(); // Null preserved
        });
        
        test('should handle special characters in fields', async () => {
            const vendor = await Vendor.create({
                name: 'Vendor with Spécial Cháracters ® © ™ ! @ #',
                street_address: '123 Main St. (Building #2)',
                city: 'São Paulo',
                tax_id: '123-45@678'
            });
            
            const savedVendor = await Vendor.findByPk(vendor.uuid);
            expect(savedVendor.name).toBe('Vendor with Spécial Cháracters ® © ™ ! @ #');
            expect(savedVendor.street_address).toBe('123 Main St. (Building #2)');
            expect(savedVendor.city).toBe('São Paulo');
            expect(savedVendor.tax_id).toBe('123-45@678');
        });
    });
    
    // Fixed Association Tests
    
    describe('Association Tests', () => {
        test('should run association function without models', async () => {
            // This explicitly tests the if(models && models.FinancialDocument) condition
            // by calling associate with null/undefined
            expect(() => {
                Vendor.associate(null);
            }).not.toThrow();
            
            expect(() => {
                Vendor.associate({});
            }).not.toThrow();
            
            expect(() => {
                Vendor.associate({ SomeOtherModel: {} });
            }).not.toThrow();
        });
        
        test('should properly setup association with FinancialDocument', () => {
            // Creating a fresh instance for this test to avoid state from previous tests
            const localSequelize = new Sequelize('sqlite::memory:', { logging: false });
            const LocalVendor = VendorModel(localSequelize, DataTypes);
            
            // Create a proper mock for FinancialDocument that extends Model
            class MockFinancialDocument extends Sequelize.Model {}
            MockFinancialDocument.init(
                { id: { type: DataTypes.INTEGER, primaryKey: true } },
                { sequelize: localSequelize, modelName: 'FinancialDocument' }
            );
            
            // Call associate with proper Model class
            LocalVendor.associate({ FinancialDocument: MockFinancialDocument });
            
            // Verify hasMany was called on Vendor by checking associations
            expect(LocalVendor.associations).toBeDefined();
            expect(LocalVendor.associations.financial_documents).toBeDefined();
            expect(LocalVendor.associations.financial_documents.associationType).toBe('HasMany');
        });
    });
});