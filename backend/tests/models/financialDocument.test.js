const { DataTypes, Sequelize } = require('sequelize');
const FinancialDocumentFactory = require('../../src/models/financialDocument');
const PartnerModel = require('../../src/models/partner');
const CustomerModel = require('../../src/models/customer');
const VendorModel = require('../../src/models/vendor');

describe('FinancialDocument Model', () => {
    let sequelize;
    let FinancialDocument;
    let Partner;
    let partnerId;
    let Customer;
    let Vendor;

    beforeEach(async () => {
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        FinancialDocument = FinancialDocumentFactory(sequelize, DataTypes);
        Partner = PartnerModel(sequelize, DataTypes);
        Customer = CustomerModel(sequelize, DataTypes);
        Vendor = VendorModel(sequelize, DataTypes);

        FinancialDocument.associate({ Partner, Customer, Vendor });
        Partner.associate?.({ FinancialDocument });
        Customer.associate?.({ FinancialDocument });
        Vendor.associate?.({ FinancialDocument });

        await sequelize.sync({ force: true });
        
        const partner = await Partner.create({
            uuid: "test-partner-uuid",
            name: "Test Partner",
            email: "test@example.com",
            password: "password123",
            created_at: new Date()
        });
        partnerId = partner.uuid;
    });
    
    afterEach(async () => {
        await sequelize.close();
    });

    test('it should have common financial document attributes', () => {
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('due_date');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('total_amount');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('subtotal_amount');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('discount_amount');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('payment_terms');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('file_url');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('status');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('partner_id');
    });

    test('should handle when models is undefined', () => {
        FinancialDocument.associate(undefined);
        expect(true).toBeTruthy();
    });
    
    test('should handle when Partner model is not provided', () => {
        FinancialDocument.associate({ SomeOtherModel: {} });
        expect(true).toBeTruthy();
    });

    test('should associate with a customer', async () => {
        // Create a test customer
        const customer = await Customer.create({
            name: 'Test Customer',
            email: 'customer@example.com'
        });
        
        // Create a financial document linked to the customer
        const document = await FinancialDocument.create({
            status: 'Processing',
            partner_id: partnerId,
            customer_id: customer.uuid
        });
        
        // Retrieve the document with its customer
        const documentWithCustomer = await FinancialDocument.findByPk(document.id, {
            include: [{
                model: Customer,
                as: 'customer'
            }]
        });
        
        expect(documentWithCustomer.customer).toBeTruthy();
        expect(documentWithCustomer.customer.name).toBe('Test Customer');
        expect(documentWithCustomer.customer.uuid).toBe(customer.uuid);
    });
    
    // Also add a test to check that customer_id is null by default
    test('customer_id should be nullable', async () => {
        const document = await FinancialDocument.create({
            status: 'Processing',
            partner_id: partnerId
        });
        
        expect(document.customer_id).toBeNull();
    });
    test('should associate with a vendor', async () => {
        // Create a test vendor
        const vendor = await Vendor.create({
            name: 'Test Vendor',
            email: 'vendor@example.com'
        });
        
        // Create a financial document linked to the vendor
        const document = await FinancialDocument.create({
            status: 'Processing',
            partner_id: partnerId,
            vendor_id: vendor.uuid
        });
        
        // Retrieve the document with its vendor
        const documentWithVendor = await FinancialDocument.findByPk(document.id, {
            include: [{
                model: Vendor,
                as: 'vendor'
            }]
        });
        
        expect(documentWithVendor.vendor).toBeTruthy();
        expect(documentWithVendor.vendor.name).toBe('Test Vendor');
        expect(documentWithVendor.vendor.uuid).toBe(vendor.uuid);
    });
    
    // Also add a test to check that vendor_id is null by default
    test('vendor_id should be nullable', async () => {
        const document = await FinancialDocument.create({
            status: 'Processing',
            partner_id: partnerId
        });
        
        expect(document.vendor_id).toBeNull();
    });
    describe('Positive Cases', () => {
        test('should create financial document with only required fields', async () => {
            const document = await FinancialDocument.create({
                status: 'Analyzed',
                partner_id: partnerId
            });
            
            expect(document).toBeTruthy();
            expect(document.status).toBe('Analyzed');
            expect(document.partner_id).toBe(partnerId);
            expect(document.due_date).toBeUndefined();
        });
        
        test('should associate correctly with Partner model', async () => {
            const document = await FinancialDocument.create({
                status: 'Processing',
                partner_id: partnerId
            });
            
            const documentWithPartner = await FinancialDocument.findByPk(document.id, {
                include: [{
                    model: Partner,
                    as: 'partner'
                }]
            });
            
            expect(documentWithPartner.partner).toBeTruthy();
            expect(documentWithPartner.partner.uuid).toBe(partnerId);
        });
    });
    
    describe('Negative Cases', () => {
        test('should fail if status is not one of allowed values', async () => {
            await expect(
                FinancialDocument.create({
                    status: 'Invalid',
                    partner_id: partnerId
                })
            ).rejects.toThrow("status must be one of 'Processing', 'Analyzed', or 'Failed'");
        });
        
        test('should fail if total_amount is negative', async () => {
            await expect(
                FinancialDocument.create({
                    status: 'Processing',
                    partner_id: partnerId,
                    total_amount: -100
                })
            ).rejects.toThrow('Validation min on total_amount failed');
        });
        
        test('should fail if partner_id is missing', async () => {
            await expect(
                FinancialDocument.create({
                    status: 'Processing'
                })
            ).rejects.toThrow('notNull Violation: FinancialDocument.partner_id cannot be null');
        });
    });
    
    describe('Corner Cases', () => {
        test('should handle zero total_amount', async () => {
            const document = await FinancialDocument.create({
                status: 'Processing',
                partner_id: partnerId,
                total_amount: 0
            });
            
            expect(document).toBeTruthy();
            expect(document.total_amount).toBe(0);
        });
        
        test('should handle very large amounts', async () => {
            const document = await FinancialDocument.create({
                status: 'Processing',
                partner_id: partnerId,
                total_amount: 999999999.99,
                subtotal_amount: 999999999.99
            });
            
            expect(document).toBeTruthy();
            expect(document.total_amount).toBe(999999999.99);
        });
        
        test('should handle empty strings for optional string fields', async () => {
            const document = await FinancialDocument.create({
                status: 'Processing',
                partner_id: partnerId,
                payment_terms: '',
                file_url: ''
            });
            
            expect(document).toBeTruthy();
            expect(document.payment_terms).toBe('');
            expect(document.file_url).toBe('');
        });
    });
});
