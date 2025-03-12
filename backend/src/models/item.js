'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Item extends Model {
        static associate(models) {
            if (models?.FinancialDocument) {
                Item.hasMany(models.FinancialDocument, {
                    foreignKey: 'item_id',
                    as: 'financial_documents'
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
        quantity: {
            type: DataTypes.DECIMAL,
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