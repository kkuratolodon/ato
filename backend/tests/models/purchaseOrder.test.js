const { DataTypes, Sequelize } = require('sequelize');
const PurchaseOrderFactory = require('../../src/models/purchaseOrder');
const PartnerModel = require('../../src/models/partner');
const CustomerModel = require("../../src/models/customer");
const VendorModel = require("../../src/models/vendor");
const item = require("../../src/models/item");

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
        // Setup associations
        PurchaseOrder.associate({ Partner, Customer, Vendor, Item });
        Partner.associate?.({ PurchaseOrder });
        Customer.associate && Customer.associate({ PurchaseOrder })
        Vendor.associate && Vendor.associate({ PurchaseOrder });
        Item.associate && Item.associate({ FinancialDocument: PurchaseOrder });
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
        expect(Object.keys(PurchaseOrder.rawAttributes)).toContain('po_date');
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
                status: "Processing",
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
                po_date: new Date('2024-01-01'),
                po_number: 'PO-2024-001',
                due_date: new Date('2024-02-01'),
                total_amount: 1000.50,
                subtotal_amount: 1200.00,
                discount_amount: 199.50,
                payment_terms: 'Net 30',
                file_url: 'https://example.com/doc.pdf',
                status: 'Processing',
                partner_id: partnerId
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.po_number).toBe('PO-2024-001');
            expect(purchaseOrder.total_amount).toBe(1000.50);
            expect(purchaseOrder.status).toBe('Processing');
        });

        test('should create purchase order with only required fields', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: 'Analyzed',
                partner_id: partnerId
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.status).toBe('Analyzed');
            expect(purchaseOrder.partner_id).toBe(partnerId);
            expect(purchaseOrder.due_date).toBeUndefined();
            expect(purchaseOrder.po_date).toBeUndefined();
            expect(purchaseOrder.po_number).toBeUndefined();
        });

        test('should associate correctly with Partner model', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: 'Processing',
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
    });

    describe('Negative Cases', () => {
        test('should fail if status is not one of allowed values', async () => {
            await expect(
                PurchaseOrder.create({
                    status: 'Invalid',
                    partner_id: partnerId
                })
            ).rejects.toThrow("status must be one of 'Processing', 'Analyzed', or 'Failed'");
        });

        test('should fail if total_amount is negative', async () => {
            await expect(
                PurchaseOrder.create({
                    status: 'Processing',
                    partner_id: partnerId,
                    total_amount: -100
                })
            ).rejects.toThrow('Validation min on total_amount failed');
        });

        test('should fail if partner_id is missing', async () => {
            await expect(
                PurchaseOrder.create({
                    status: 'Processing'
                })
            ).rejects.toThrow('notNull Violation: PurchaseOrder.partner_id cannot be null');
        });

        test('should fail if due_date is earlier than po_date', async () => {
            await expect(
                PurchaseOrder.create({
                    po_date: new Date('2024-05-01'),
                    due_date: new Date('2024-04-30'), // Earlier than po_date
                    status: 'Processing',
                    partner_id: partnerId
                })
            ).rejects.toThrow('due_date must not be earlier than po_date');
        });
    });

    describe('Corner Cases', () => {
        test('should handle zero total_amount', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: 'Processing',
                partner_id: partnerId,
                total_amount: 0
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.total_amount).toBe(0);
        });

        test('should allow same date for po_date and due_date', async () => {
            const sameDate = new Date('2024-05-01');
            const purchaseOrder = await PurchaseOrder.create({
                po_date: sameDate,
                due_date: sameDate,
                status: 'Processing',
                partner_id: partnerId
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.po_date).toEqual(purchaseOrder.due_date);
        });

        test('should handle very large amounts', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: 'Processing',
                partner_id: partnerId,
                total_amount: 999999999.99,
                subtotal_amount: 999999999.99
            });

            expect(purchaseOrder).toBeTruthy();
            expect(purchaseOrder.total_amount).toBe(999999999.99);
        });

        test('should handle empty strings for optional string fields', async () => {
            const purchaseOrder = await PurchaseOrder.create({
                status: 'Processing',
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
});