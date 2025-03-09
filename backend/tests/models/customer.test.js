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
            email: 'customer@example.com',
            street_address: '123 Main St',
            city: 'Test City',
            state: 'Test State',
            postal_code: '12345',
            houseAddress: 'Apt 4B',
            phone: '123-456-7890'
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
        expect(Customer.rawAttributes).toHaveProperty('email');
        expect(Customer.rawAttributes).toHaveProperty('street_address');
        expect(Customer.rawAttributes).toHaveProperty('city');
        expect(Customer.rawAttributes).toHaveProperty('state');
        expect(Customer.rawAttributes).toHaveProperty('postal_code');
        expect(Customer.rawAttributes).toHaveProperty('phone');
    });
    
    // Basic CRUD tests
    test('should create a customer successfully', async () => {
        const customer = await Customer.findByPk(customerId);
        
        expect(customer).toBeTruthy();
        expect(customer.name).toBe('Test Customer');
        expect(customer.email).toBe('customer@example.com');
        expect(customer.city).toBe('Test City');
    });
    
    test('should validate email format', async () => {
        await expect(
            Customer.create({
                name: 'Invalid Email Customer',
                email: 'not-an-email'
            })
        ).rejects.toThrow('Invalid email format');
    });
    
    // Association tests
    test('should associate with financial documents', async () => {
        // Create a financial document associated with the customer
        await FinancialDocument.create({
            status: 'Processing',
            partner_id: 'test-partner-id', // Mock partner ID
            customer_id: customerId
        });
        
        // Query customer with associated financial documents
        const customerWithDocs = await Customer.findByPk(customerId, {
            include: [{
                model: FinancialDocument,
                as: 'financialDocuments'
            }]
        });
        
        expect(customerWithDocs.financialDocuments).toBeTruthy();
        expect(customerWithDocs.financialDocuments.length).toBe(1);
        expect(customerWithDocs.financialDocuments[0].status).toBe('Processing');
    });
});