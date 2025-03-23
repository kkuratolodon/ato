const { DataTypes, Sequelize } = require('sequelize');
const CustomerModel = require('../../src/models/customer');
const InvoiceModel = require('../../src/models/invoice');
const PurchaseOrderModel = require('../../src/models/purchaseOrder');

describe('Customer Model', () => {
    let sequelize;
    let Customer;
    let Invoice;
    let PurchaseOrder;
    let customerId;

    beforeEach(async () => {
        // Create in-memory database
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        Customer = CustomerModel(sequelize, DataTypes);
        Invoice = InvoiceModel(sequelize, DataTypes);
        PurchaseOrder = PurchaseOrderModel(sequelize, DataTypes);

        // Setup associations
        Customer.associate({ Invoice, PurchaseOrder });
        Invoice.belongsTo(Customer, {
            foreignKey: 'customer_id',
            as: 'customer'
        });
        PurchaseOrder.belongsTo(Customer, {
            foreignKey: 'customer_id',
            as: 'customer'
        });

        // Sync models to database
        await sequelize.sync({ force: true });

        // Create a test customer
        const customer = await Customer.create({
            name: 'Test Customer',
        });
        customerId = customer.uuid;
    });

    afterEach(async () => {
        await sequelize.close();
    });

    // Basic structure test
    test('it should have required customer attributes', () => {
        expect(Customer.rawAttributes).toHaveProperty('uuid');
        expect(Customer.rawAttributes).toHaveProperty('address');
        expect(Customer.rawAttributes).toHaveProperty('name');
    });

    // Basic CRUD tests
    test('should create a customer successfully', async () => {
        const customer = await Customer.findByPk(customerId);

        expect(customer).toBeTruthy();
        expect(customer.name).toBe('Test Customer');
        expect(customer.city).toBe('Test City');
    });

    // You can add association tests here if needed
    test('should have correct association with Invoice', () => {
        expect(Customer.associations).toBeDefined();
        expect(Customer.associations.invoices).toBeDefined();
        expect(Customer.associations.invoices.associationType).toBe('HasMany');
    });

    test('should have correct association with PurchaseOrder', () => {
        expect(Customer.associations).toBeDefined();
        expect(Customer.associations.purchase_orders).toBeDefined();
        expect(Customer.associations.purchase_orders.associationType).toBe('HasMany');
    });
    test('should properly setup association with FinancialDocument when available', () => {
        // Create a new sequelize instance to avoid affecting other tests
        const localSequelize = new Sequelize('sqlite::memory:', { logging: false });

        // Initialize the Customer model
        const LocalCustomer = CustomerModel(localSequelize, DataTypes);

        // Create a mock FinancialDocument model
        const FinancialDocument = localSequelize.define('FinancialDocument', {
            uuid: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            // Add minimal fields needed for testing
            status: DataTypes.STRING,
            total_amount: DataTypes.DECIMAL
        });

        // Call associate with the mock FinancialDocument
        LocalCustomer.associate({ FinancialDocument });

        // Check that the association was correctly set up
        expect(LocalCustomer.associations).toBeDefined();
        expect(LocalCustomer.associations.financial_documents).toBeDefined();
        expect(LocalCustomer.associations.financial_documents.associationType).toBe('HasMany');
        expect(LocalCustomer.associations.financial_documents.foreignKey).toBe('customer_id');
    });
});