'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Item extends Model {
        static associate(models) {
            if (!models) return;
            if (models.Invoice) {
                // Perhatikan perubahan dari belongsToMany menjadi belongsTo
                Item.belongsTo(models.Invoice, {
                    foreignKey: 'document_id',
                    constraints: false,
                    scope: {
                        document_type: 'invoice'
                    }
                });
            }
            
            if (models.PurchaseOrder) {
                // Perhatikan perubahan dari belongsToMany menjadi belongsTo
                Item.belongsTo(models.PurchaseOrder, {
                    foreignKey: 'document_id',
                    constraints: false,
                    scope: {
                        document_type: 'purchase_order'
                    }
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
        // Menambahkan field dari FinancialDocumentItem
        document_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        document_type: {
            type: DataTypes.STRING,
            allowNull: true
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        unit: {
            type: DataTypes.STRING,
            allowNull: true
        },
        unit_price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Item',
        tableName: 'Item',
        freezeTableName: true
    });

    return Item;
};