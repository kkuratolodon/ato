'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Customer extends Model {
        static associate(models) {
        if (models && models.FinancialDocument) {
            Customer.hasMany(models.FinancialDocument, {
            foreignKey: 'customer_id',
            as: 'financialDocuments'
            });
        }
        }
    }

    Customer.init({
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
        houseAddress: {
        type: DataTypes.TEXT,
        allowNull: true
        },
        email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: {
            msg: "Invalid email format"
            }
        }
        },
        phone: {
        type: DataTypes.STRING,
        allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Customer',
        tableName: 'Customer',
        freezeTableName: true
    });

    return Customer;
};