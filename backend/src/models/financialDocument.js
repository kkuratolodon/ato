'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class FinancialDocument extends Model {
        static associate(models) {
            if (models && models.Partner) {
                FinancialDocument.belongsTo(models.Partner, { 
                    foreignKey: 'partner_id', 
                    targetKey: 'uuid',
                    as: 'partner'
                });
            }
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
        subtotal_amount: { 
            type: DataTypes.DECIMAL, 
            allowNull: true 
        },
        discount_amount: { 
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
        }
    }, {
        sequelize,
        modelName: 'FinancialDocument',
        tableName: 'FinancialDocument',
        freezeTableName: true
    });

    return FinancialDocument;
};