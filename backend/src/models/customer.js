'use strict';
const BusinessEntity = require('./base/BusinessEntity');

module.exports = (sequelize, DataTypes) => {
    class Customer extends BusinessEntity {
        static associate(models) {
            // Handle the abstract base class
            if (models?.FinancialDocument) {
                Customer.hasMany(models.FinancialDocument, {
                    foreignKey: 'customer_id',
                    as: 'financial_documents'
                });
            }
            
            // Handle concrete implementations too
            if (models?.Invoice) {
                Customer.hasMany(models.Invoice, {
                    foreignKey: 'customer_id',
                    as: 'invoices'
                });
            }
            
            if (models?.PurchaseOrder) {
                Customer.hasMany(models.PurchaseOrder, {
                    foreignKey: 'customer_id',
                    as: 'purchase_orders'
                });
            }
        }
    }

    // Initialize with empty object since all fields are in BusinessEntity
    Customer.init({
    }, {
        sequelize,
        modelName: 'Customer',
        tableName: 'Customer',
        freezeTableName: true,
        DataTypes // Pass DataTypes to the parent class
    });

    return Customer;
};