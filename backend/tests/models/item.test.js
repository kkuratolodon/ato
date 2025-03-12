const { DataTypes, Sequelize } = require('sequelize');
const ItemModel = require('../../src/models/item');
const FinancialDocumentModel = require('../../src/models/financialDocument');

describe('Item Model', () => {
    let sequelize;
    let Item;
    let FinancialDocument;

    beforeEach(async () => {
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        
        Item = ItemModel(sequelize, DataTypes);
        FinancialDocument = FinancialDocumentModel(sequelize, DataTypes);
        
        Item.associate({ FinancialDocument });
        FinancialDocument.associate && FinancialDocument.associate({ Item });
        
        await sequelize.sync({ force: true });
    });
    
    afterEach(async () => {
        await sequelize.close();
    });

    test('it should have required item attributes', () => {
        expect(Item.rawAttributes).toHaveProperty('uuid');
        expect(Item.rawAttributes).toHaveProperty('description');
        expect(Item.rawAttributes).toHaveProperty('quantity');
        expect(Item.rawAttributes).toHaveProperty('unit');
        expect(Item.rawAttributes).toHaveProperty('unit_price');
        expect(Item.rawAttributes).toHaveProperty('amount');
    });
});