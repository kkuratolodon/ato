'use strict';
const { Model } = require('sequelize');
const FinancialDocumentFactory = require('./financialDocument');

module.exports = (sequelize, DataTypes) => {
    const FinancialDocument = FinancialDocumentFactory(sequelize, DataTypes);
    
    class PurchaseOrder extends FinancialDocument {
        static associate(models) {
        if (models && models.Partner) {
            PurchaseOrder.belongsTo(models.Partner, { 
            foreignKey: 'partner_id', 
            targetKey: 'uuid',
            as: 'partner'
            });
        }
        
        // Add customer association
        if (models && models.Customer) {
            PurchaseOrder.belongsTo(models.Customer, { 
            foreignKey: 'customer_id', 
            targetKey: 'uuid',
            as: 'customer'
            });
        }
        
        // Add vendor association
        if (models && models.Vendor) {
            PurchaseOrder.belongsTo(models.Vendor, { 
            foreignKey: 'vendor_id', 
            targetKey: 'uuid',
            as: 'vendor'
            });
        }
        }
    }

    const financialDocAttributes = { ...FinancialDocument.getAttributes() };
    delete financialDocAttributes.id;
    delete financialDocAttributes.createdAt;
    delete financialDocAttributes.updatedAt;

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
        },
        ...Object.fromEntries(
            Object.entries(financialDocAttributes)
            .filter(([key]) => !['due_date'].includes(key))
        )
    }, {
        sequelize,
        modelName: 'PurchaseOrder',
        tableName: 'PurchaseOrder',
        freezeTableName: true
    });

    return PurchaseOrder;
};