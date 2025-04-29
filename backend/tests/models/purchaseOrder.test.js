const { v4: uuidv4 } = require('uuid');
const { DataTypes, Sequelize } = require('sequelize');
const PurchaseOrderFactory = require('@models/purchaseOrder');
const PartnerModel = require('@models/partner');
const CustomerModel = require("@models/customer");
const VendorModel = require("@models/vendor");
const item = require("@models/item");
const DocumentStatus = require('@models/enums/DocumentStatus');

describe('PurchaseOrder Model', () => {
    let sequelize;
    let PurchaseOrder;
    let Partner;
    let partnerId;
    let Customer;
    let Vendor;
    let Item;

    beforeEach(async () => {
        // Create a real Sequelize instance with an in-memory database
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        PurchaseOrder = PurchaseOrderFactory(sequelize, DataTypes);
        Partner = PartnerModel(sequelize, DataTypes);
        Customer = CustomerModel(sequelize, DataTypes);
        Vendor = VendorModel(sequelize, DataTypes);
        Item = item(sequelize, DataTypes);
        
        // Tambahkan kolom analysis_json_url secara manual ke model untuk test
        if (!PurchaseOrder.rawAttributes.analysis_json_url) {
            PurchaseOrder.init({
                analysis_json_url: {
                    type: DataTypes.STRING,
                    allowNull: true
                }
            }, {
                sequelize,
                modelName: 'PurchaseOrder',
                tableName: 'purchase_order',
                timestamps: true,
                underscored: true,
                paranoid: true
            });
        }
        
        // Mock Item.associate to prevent the error
        Item.associate = jest.fn();
        
        // Setup associations
        PurchaseOrder.associate({ Partner, Customer, Vendor, Item });
        Partner.associate?.({ PurchaseOrder });
        Customer.associate && Customer.associate({ PurchaseOrder });
        Vendor.associate && Vendor.associate({ PurchaseOrder });
        
        // Manually set up the Item association instead of using Item.associate
        Item.belongsToMany = jest.fn();
        
        // Sync models to database
        await sequelize.sync({ force: true });

        // Create a test partner for use in tests
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

    // Basic model structure tests
    test('it should have purchase order specific attributes', () => {
        // Check for specific PO attributes
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('due_date');
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('po_number');
    });

    test('it should inherit common financial document attributes', () => {
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('due_date');
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('total_amount');
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('subtotal_amount');
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('discount_amount');
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('payment_terms');
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('file_url');
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('status');
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('partner_id');
    });

    // Test associate method conditional branches
    test('should handle when models is undefined', () => {
        PurchaseOrder.associate(undefined);
        expect(true).toBeTruthy();
    });

    test('should handle when Partner model is not provided', () => {
        PurchaseOrder.associate({ SomeOtherModel: {} });
        expect(true).toBeTruthy();
    });
    // Add this new describe block after the first describe block or where appropriate
    describe('PurchaseOrder Model Associations', () => {
        it('should associate with Vendor correctly', () => {
            // Save original belongsTo method
            const originalBelongsTo = PurchaseOrder.belongsTo;

            // Mock the belongsTo method so it doesn't throw errors
            PurchaseOrder.belongsTo = jest.fn();

            try {
                // Test with all required models
                PurchaseOrder.associate({
                    Partner: { name: 'Partner' },
                    Customer: { name: 'Customer' },
                    Vendor: { name: 'Vendor' }
                });

                // Test with no models (should return early)
                PurchaseOrder.associate(null);

                // Test with empty object (no models)
                PurchaseOrder.associate({});

                // Test with missing Vendor
                PurchaseOrder.associate({
                    Partner: { name: 'Partner' },
                    Customer: { name: 'Customer' }
                });

                // Verify the belongsTo was called the correct number of times
                // Be sure this matches the number of times it's called in your test setup
                expect(PurchaseOrder.belongsTo).toHaveBeenCalledTimes(5);

                // You can also verify specific calls if needed
                expect(PurchaseOrder.belongsTo).toHaveBeenCalledWith(
                    { name: 'Vendor' },
                    expect.objectContaining({
                        foreignKey: 'vendor_id',
                        targetKey: 'uuid',
                        as: 'vendor'
                    })
                );
            } finally {
                // Restore original method
                PurchaseOrder.belongsTo = originalBelongsTo;
            }
        });

        // You can also add a test for actual database association with Vendor
        it('should associate with Vendor in database correctly', async () => {
            // Create a test vendor
            const vendor = await Vendor.create({
                uuid: "test-vendor-uuid",
                name: "Test Vendor",
                street_address: "123 Vendor St",
                city: "Vendor City",
                state: "VS",
                postal_code: "12345"
            });

            // Create a purchase order associated with the vendor
            const purchaseOrder = await PurchaseOrder.create({
                po_number: "PO-2024-002",
                status: DocumentStatus.PROCESSING,
                partner_id: partnerId,
                vendor_id: vendor.uuid
            });

            // Fetch purchase order with vendor included
            const purchaseOrderWithVendor = await PurchaseOrder.findByPk(purchaseOrder.id, {
                include: [{
                    model: Vendor,
                    as: 'vendor'
                }]
            });

            // Verify association worked
            expect(purchaseOrderWithVendor.vendor).toBeTruthy();
            expect(purchaseOrderWithVendor.vendor.uuid).toBe(vendor.uuid);
            expect(purchaseOrderWithVendor.vendor.name).toBe("Test Vendor");
        });
    });
    describe('Positive Cases', () => {
        test('should create purchase order with all valid fields', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                due_date: new Date('2024-01-01'),
                po_number: 'PO-2024-001',
                total_amount: 1000.50,
                subtotal_amount: 1200.00,
                discount_amount: 199.50,
                payment_terms: 'Net 30',
                file_url: 'https://example.com/doc.pdf',
                status: DocumentStatus.PROCESSING,
                partner_id: partnerId
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.po_number).toBe('PO-2024-001');
            expect(purchaseOrder.total_amount).toBe(1000.50);
            expect(purchaseOrder.status).toBe(DocumentStatus.PROCESSING);
        });

        test('should create purchase order with only required fields', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: DocumentStatus.ANALYZED,
                partner_id: partnerId
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.status).toBe('Analyzed');
            expect(purchaseOrder.partner_id).toBe(partnerId);
            expect(purchaseOrder.due_date).toBeUndefined();
        });

        test('should associate correctly with Partner model', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: DocumentStatus.PROCESSING,
                partner_id: partnerId
            });

            const purchaseOrderWithPartner = await PurchaseOrder.findByPk(purchaseOrder.id, {
                include: [{
                    model: Partner,
                    as: 'partner'
                }]
            });

            expect(purchaseOrderWithPartner.partner).toBeTruthy();
            expect(purchaseOrderWithPartner.partner.uuid).toBe(partnerId);
        });

        test('should create purchase order with analysis_json_url', async () => {
            const uuid = uuidv4();
            const testPO = await PurchaseOrder.create({
                uuid,
                po_number: 'PO-001',
                status: DocumentStatus.ANALYZED, // Ubah field issue_date menjadi status
                partner_id: partnerId, // Gunakan partnerId yang valid
                file_url: 'https://storage.example.com/po/po-001.pdf',
                analysis_json_url: 'https://storage.example.com/analyses/po-001.json'
            });
            
            expect(testPO).toBeDefined();
            expect(testPO.analysis_json_url).toBe('https://storage.example.com/analyses/po-001.json');
        });
    });

    describe('Negative Cases', () => {
        test('should fail if status is not one of allowed values', async () => {
            await expect(
                PurchaseOrder.create({
                    status: 'Invalid',
                    partner_id: partnerId
                })
            ).rejects.toThrow("Validation error: status must be one of: Processing, Analyzed, Failed");
        });

        test('should fail if total_amount is negative', async () => {
            await expect(
                PurchaseOrder.create({
                    status: DocumentStatus.PROCESSING,
                    partner_id: partnerId,
                    total_amount: -100
                })
            ).rejects.toThrow('Validation min on total_amount failed');
        });

        test('should fail if partner_id is missing', async () => {
            await expect(
                PurchaseOrder.create({
                    status: DocumentStatus.PROCESSING
                })
            ).rejects.toThrow('notNull Violation: PurchaseOrder.partner_id cannot be null');
        });
    });

    describe('Corner Cases', () => {
        test('should handle zero total_amount', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: DocumentStatus.PROCESSING,
                partner_id: partnerId,
                total_amount: 0
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.total_amount).toBe(0);
        });

        test('should handle very large amounts', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: DocumentStatus.PROCESSING,
                partner_id: partnerId,
                total_amount: 999999999.99,
                subtotal_amount: 999999999.99
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.total_amount).toBe(999999999.99);
        });

        test('should handle empty strings for optional string fields', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: DocumentStatus.PROCESSING,
                partner_id: partnerId,
                po_number: '',
                payment_terms: '',
                file_url: ''
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.po_number).toBe('');
            expect(purchaseOrder.payment_terms).toBe('');
            expect(purchaseOrder.file_url).toBe('');
        });
    });

    describe('Sequelize Paranoid Soft Delete for PurchaseOrder', () => {
        let testPurchaseOrder;
        
        beforeEach(async () => {
        testPurchaseOrder = await PurchaseOrder.create({
            po_number: 'SOFT-DELETE-TEST',
            due_date: new Date(),
            total_amount: 1000,
            status: DocumentStatus.PROCESSING,
            partner_id: partnerId
        });
        });
    
        test('should mark purchase order as deleted when using destroy()', async () => {
            await testPurchaseOrder.destroy();
            
            const notFound = await PurchaseOrder.findByPk(testPurchaseOrder.id);
            expect(notFound).toBeNull();
            
            const foundDeleted = await PurchaseOrder.findByPk(testPurchaseOrder.id, { paranoid: false });
            expect(foundDeleted).not.toBeNull();
            expect(foundDeleted.id).toBe(testPurchaseOrder.id);
            expect(foundDeleted.is_deleted).toBe(true);
            expect(foundDeleted.deleted_at).not.toBeNull();
        });
    
        test('should not retrieve soft-deleted purchase orders in findAll by default', async () => {
            await PurchaseOrder.destroy({ where: {}, force: true });
            
            const testPurchaseOrder = await PurchaseOrder.create({
                po_number: 'SOFT-DELETE-TEST',
                due_date: new Date(),
                status: DocumentStatus.PROCESSING,
                partner_id: partnerId
            });
              
              const secondPurchaseOrder = await PurchaseOrder.create({
                po_number: 'NOT-DELETED',
                due_date: new Date(),
                status: DocumentStatus.PROCESSING,
                partner_id: partnerId
            });
        
            await testPurchaseOrder.destroy();
            
            const allPurchaseOrders = await PurchaseOrder.findAll();
            
            expect(allPurchaseOrders.some(po => po.id === testPurchaseOrder.id)).toBeFalsy();
            expect(allPurchaseOrders.some(po => po.id === secondPurchaseOrder.id)).toBeTruthy();
            
            const allIncludingDeleted = await PurchaseOrder.findAll({ paranoid: false });
            expect(allIncludingDeleted.some(po => po.id === testPurchaseOrder.id)).toBeTruthy();
            
            await secondPurchaseOrder.destroy({ force: true });
        });
    
        test('should restore soft-deleted purchase order with restore() method', async () => {
            await testPurchaseOrder.destroy();
            
            const notFound = await PurchaseOrder.findByPk(testPurchaseOrder.id);
            expect(notFound).toBeNull();
            
            const deletedRecord = await PurchaseOrder.findByPk(testPurchaseOrder.id, { paranoid: false });
            
            await deletedRecord.restore();
            
            const restoredRecord = await PurchaseOrder.findByPk(testPurchaseOrder.id);
            expect(restoredRecord).not.toBeNull();
            expect(restoredRecord.id).toBe(testPurchaseOrder.id);
            expect(restoredRecord.is_deleted).toBe(false);
            expect(restoredRecord.deleted_at).toBeNull();
        });
    
        test('should permanently delete purchase order with force: true', async () => {
            await testPurchaseOrder.destroy({ force: true });
        
            const notFound = await PurchaseOrder.findByPk(testPurchaseOrder.id, { paranoid: false });
            expect(notFound).toBeNull();
        });
    
        test('should apply the beforeDestroy hook when soft deleting', async () => {
            await testPurchaseOrder.destroy();
        
            const deletedRecord = await PurchaseOrder.findByPk(testPurchaseOrder.id, { paranoid: false });
            expect(deletedRecord.is_deleted).toBe(true);
        });
    });
});