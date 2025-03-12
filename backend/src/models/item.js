'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Item extends Model {
        static associate(models) {
            Item.belongsToMany(models.FinancialDocument, {
                through: 'FinancialDocumentItem',
                foreignKey: 'item_id',
                otherKey: 'financial_document_id',
                as: 'financial_documents'
            });
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