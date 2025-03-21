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
            street_address: '123 Main St',
            city: 'Test City',
            state: 'Test State',
            postal_code: '12345',
            houseAddress: 'Apt 4B',
        });
        customerId = customer.uuid;
    });
    
    afterEach(async () => {
        await sequelize.close();
    });

    // Basic structure test
    test('it should have required customer attributes', () => {
        expect(Customer.rawAttributes).toHaveProperty('uuid');
        expect(Customer.rawAttributes).toHaveProperty('name');
        expect(Customer.rawAttributes).toHaveProperty('street_address');
        expect(Customer.rawAttributes).toHaveProperty('city');
        expect(Customer.rawAttributes).toHaveProperty('state');
        expect(Customer.rawAttributes).toHaveProperty('postal_code');
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
});