'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class FinancialDocumentItem extends Model {
    }

    FinancialDocumentItem.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        financial_document_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'FinancialDocument',
                key: 'uuid'
            }
        },
        item_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Item',
                key: 'uuid'
            }
        },
        quantity: {
            type: DataTypes.DECIMAL,
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
        modelName: 'FinancialDocumentItem',
        tableName: 'FinancialDocumentItem',
        freezeTableName: true
    });

    return FinancialDocumentItem;
};