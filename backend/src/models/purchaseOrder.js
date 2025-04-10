'use strict';
const FinancialDocument = require('./base/financialDocument');

module.exports = (sequelize, DataTypes) => {
    class PurchaseOrder extends FinancialDocument {
        static associate(models) {
            if (!models) return;
            if (models.Partner) {
                PurchaseOrder.belongsTo(models.Partner, { 
                    foreignKey: 'partner_id', 
                    targetKey: 'uuid',
                    as: 'partner'
                });
            }
            
            if (models.Customer) {
                PurchaseOrder.belongsTo(models.Customer, { 
                    foreignKey: 'customer_id', 
                    targetKey: 'uuid',
                    as: 'customer'
                });
            }
            
            if (models.Vendor) {
                PurchaseOrder.belongsTo(models.Vendor, { 
                    foreignKey: 'vendor_id', 
                    targetKey: 'uuid',
                    as: 'vendor'
                });
            }
            
            if (models.Item) {
                PurchaseOrder.belongsToMany(models.Item, {
                    through: 'FinancialDocumentItem',
                    foreignKey: 'document_id',
                    otherKey: 'item_id',
                    as: 'items'
                });
            }
        }
    }

    PurchaseOrder.init({
        po_date: { 
            type: DataTypes.DATE, 
            allowNull: true 
        },
        po_number: { 
            type: DataTypes.STRING, 
            allowNull: true,
        },
        due_date: {
            type: DataTypes.VIRTUAL, // This makes the field virtual (not stored in DB)
            get: function() {
                return null; // Always returns null when accessed
            },
            set: function() {
                // Do nothing when attempted to set
            }
        }
    }, {
        sequelize,
        modelName: 'PurchaseOrder',
        tableName: 'PurchaseOrder',
        freezeTableName: true,
        DataTypes
    });

    return PurchaseOrder;
};