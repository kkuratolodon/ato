'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Item extends Model {
        static associate(models) {
            if (!models) return;
            if (models.Invoice) {
                Item.belongsToMany(models.Invoice, {
                    through: 'FinancialDocumentItem',
                    foreignKey: 'item_id',
                    otherKey: 'document_id',
                    as: 'invoices',
                    constraints: false
                });
            }
            
            if (models.PurchaseOrder) {
                Item.belongsToMany(models.PurchaseOrder, {
                    through: 'FinancialDocumentItem',
                    foreignKey: 'item_id',
                    otherKey: 'document_id',
                    as: 'purchase_orders',
                    constraints: false
                });
            }
        }
    }

    Item.init({
        uuid: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
    }, {
        sequelize,
        modelName: 'Item',
        tableName: 'Item',
        freezeTableName: true
    });

    return Item;
};