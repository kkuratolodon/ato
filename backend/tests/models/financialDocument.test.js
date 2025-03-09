const { DataTypes, Sequelize } = require('sequelize');
const FinancialDocumentFactory = require('../../src/models/financialDocument');

describe('FinancialDocument Model', () => {
    let sequelize;
    let FinancialDocument;

    beforeEach(() => {
        // Create a real Sequelize instance with an in-memory database
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        FinancialDocument = FinancialDocumentFactory(sequelize, DataTypes);
    });

    test('it should have common financial document attributes', () => {
        // Check for all the attributes in the model definition
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('due_date');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('total_amount');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('subtotal_amount');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('discount_amount');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('payment_terms');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('file_url');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('status');
        expect(Object.keys(FinancialDocument.rawAttributes)).toContain('partner_id');
    });
    
    afterEach(async () => {
        await sequelize.close();
    });
});