const { DataTypes, Sequelize } = require('sequelize');
const CustomerModel = require('../../src/models/customer');
const FinancialDocumentModel = require('../../src/models/financialDocument');

describe('Customer Model', () => {
    let sequelize;
    let Customer;
    let FinancialDocument;
    let customerId;

    beforeEach(async () => {
        // Create in-memory database
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        Customer = CustomerModel(sequelize, DataTypes);
        FinancialDocument = FinancialDocumentModel(sequelize, DataTypes);
        
        // Setup associations
        Customer.associate({ FinancialDocument });
        FinancialDocument.associate({ Customer });
        
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
});