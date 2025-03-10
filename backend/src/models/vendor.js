'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Vendor extends Model {
        static associate(models) {
            if (models && models.FinancialDocument) {
                Vendor.hasMany(models.FinancialDocument, {
                    foreignKey: 'vendor_id',
                    as: 'financial_documents'
                });
            }
        }
    }

    Vendor.init({
        uuid: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        street_address: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        city: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        state: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        postal_code: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        house: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        recipient_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        tax_id: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Vendor',
        tableName: 'Vendor',
        freezeTableName: true
    });

    return Vendor;
};