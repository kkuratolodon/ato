const { DataTypes, Sequelize } = require('sequelize');
const VendorModel = require('../../src/models/vendor');

describe('Vendor Model', () => {
    let sequelize;
    let Vendor;
    let vendorId;

    beforeEach(async () => {
        // Create in-memory database
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        Vendor = VendorModel(sequelize, DataTypes);
        
        // Sync model to database
        await sequelize.sync({ force: true });
        
        // Create a test vendor
        const vendor = await Vendor.create({
            name: 'Test Vendor',
            street_address: '456 Business Ave',
            city: 'Supplier City',
            state: 'Supply State',
            postal_code: '54321',
            house: '456',
            contact_name: 'Jane Supplier',
            tax_id: 'V-98765'
        });
        vendorId = vendor.uuid;
    });
    
    afterEach(async () => {
        await sequelize.close();
    });

    // Basic structure test
    test('it should have required vendor attributes', () => {
        expect(Vendor.rawAttributes).toHaveProperty('uuid');
        expect(Vendor.rawAttributes).toHaveProperty('name');
        expect(Vendor.rawAttributes).toHaveProperty('street_address');
        expect(Vendor.rawAttributes).toHaveProperty('city');
        expect(Vendor.rawAttributes).toHaveProperty('state');
        expect(Vendor.rawAttributes).toHaveProperty('postal_code');
        expect(Vendor.rawAttributes).toHaveProperty('house');
        expect(Vendor.rawAttributes).toHaveProperty('contact_name');
        expect(Vendor.rawAttributes).toHaveProperty('tax_id');
    });
    
    // Basic creation test
    test('should create a vendor successfully', async () => {
        const vendor = await Vendor.findByPk(vendorId);
        
        expect(vendor).toBeTruthy();
        expect(vendor.name).toBe('Test Vendor');
        expect(vendor.street_address).toBe('456 Business Ave');
        expect(vendor.city).toBe('Supplier City');
        expect(vendor.state).toBe('Supply State');
        expect(vendor.postal_code).toBe('54321');
        expect(vendor.house).toBe('456');
        expect(vendor.contact_name).toBe('Jane Supplier');
        expect(vendor.tax_id).toBe('V-98765');
    });
    
    // Test creation with minimal attributes
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
});