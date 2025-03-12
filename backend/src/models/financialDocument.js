'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class FinancialDocument extends Model {
        static associate(models) {
            models?.Partner && FinancialDocument.belongsTo(models.Partner, {
                foreignKey: 'partner_id',
                targetKey: 'uuid',
                as: 'partner'
            });

            models?.Customer && FinancialDocument.belongsTo(models.Customer, {
                foreignKey: 'customer_id',
                targetKey: 'uuid',
                as: 'customer'
            });

            models?.Vendor && FinancialDocument.belongsTo(models.Vendor, {
                foreignKey: 'vendor_id',
                targetKey: 'uuid',
                as: 'vendor'
            });
        }
    }

    FinancialDocument.init({
        due_date: {
            type: DataTypes.DATE,
            allowNull: true
        },
        total_amount: {
            type: DataTypes.DECIMAL,
            allowNull: true,
            validate: {
                min: 0
            }
        },
        currency_symbol: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '$'
        },
        currency_code: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'AUD'
        },
        subtotal_amount: {
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        discount_amount: {
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        tax_amount: {
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        payment_terms: {
            type: DataTypes.STRING,
            allowNull: true
        },
        file_url: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: {
                    args: [["Processing", "Analyzed", "Failed"]],
                    msg: "status must be one of 'Processing', 'Analyzed', or 'Failed'"
                }
            }
        },
        partner_id: {
            type: DataTypes.STRING(45),
            allowNull: false,
            defaultValue: null
        },
        customer_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'Customer',
                key: 'uuid'
            },
            defaultValue: null
        },
        vendor_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'Vendor',
                key: 'uuid'
            },
            defaultValue: null
        }
    }, {
        sequelize,
        modelName: 'FinancialDocument',
        tableName: 'FinancialDocument',
        freezeTableName: true
    });

    return FinancialDocument;
};