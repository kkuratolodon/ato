'use strict';
const BusinessEntity = require('./base/BusinessEntity');

module.exports = (sequelize, DataTypes) => {
    class Vendor extends BusinessEntity {
        static associate(models) {
            // Handle the abstract base class
            if (models?.FinancialDocument) {
                Vendor.hasMany(models.FinancialDocument, {
                    foreignKey: 'vendor_id',
                    as: 'financial_documents'
                });
            }
            
            // Handle concrete implementations too
            if (models?.Invoice) {
                Vendor.hasMany(models.Invoice, {
                    foreignKey: 'vendor_id',
                    as: 'invoices'
                });
            }
            
            if (models?.PurchaseOrder) {
                Vendor.hasMany(models.PurchaseOrder, {
                    foreignKey: 'vendor_id',
                    as: 'purchase_orders'
                });
            }
        }
    }

    // Initialize with empty object since all fields are in BusinessEntity
    Vendor.init({
    }, {
        sequelize,
        modelName: 'Vendor',
        tableName: 'Vendor',
        freezeTableName: true,
        DataTypes // Pass DataTypes to the parent class
    });

    return Vendor;
};