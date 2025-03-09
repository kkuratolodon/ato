const { DataTypes, Sequelize } = require('sequelize');
const PurchaseOrderFactory = require('../../src/models/purchaseOrder');

describe('PurchaseOrder Model', () => {
    let sequelize;
    let PurchaseOrder;

    beforeEach(() => {
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        PurchaseOrder = PurchaseOrderFactory(sequelize, DataTypes);
    });

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
    
    afterEach(async () => {
        await sequelize.close();
    });
});