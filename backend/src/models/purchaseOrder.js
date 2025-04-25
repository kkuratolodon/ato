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
                // Update Item association via belongsToMany for consistent many-to-many relations
                PurchaseOrder.belongsToMany(models.Item, {
                    through: 'Item',
                    foreignKey: 'document_id',
                    otherKey: 'uuid',
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
            type: DataTypes.DATE,
            allowNull: true,
            validate: {
                isAfterPoDate(value) {
                    if (this.po_date && new Date(value) < new Date(this.po_date)) {
                        throw new Error('due_date must not be earlier than po_date');
                    }
                }
            }
        }
    }, {
        sequelize,
        modelName: 'PurchaseOrder',
        tableName: 'PurchaseOrder',
        freezeTableName: true,
        paranoid: true,          
        deletedAt: 'deleted_at',  
        hooks: {
            beforeDestroy: (instance) => {
                instance.is_deleted = true;
            },
            afterRestore: (instance) => {
                instance.is_deleted = false;
                instance.save();
            }
        },
        DataTypes
    });

    return PurchaseOrder;
};