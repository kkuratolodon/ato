'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Invoice extends Model {
    static associate(models) {
      Invoice.belongsTo(models.Partner, { 
        foreignKey: 'partner_id', 
        targetKey: 'uuid',
        as: 'partner'
      });
    }
  }

  Invoice.init({
    invoice_date: { type: DataTypes.DATE, allowNull: false },
    due_date: { type: DataTypes.DATE, allowNull: false },
    purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
    total_amount: { 
      type: DataTypes.DECIMAL, 
      allowNull: false,
      validate: {
        min: 0,
      }
    },
    subtotal_amount: { type: DataTypes.DECIMAL, allowNull: false },
    discount_amount: { type: DataTypes.DECIMAL, allowNull: true },
    payment_terms: { type: DataTypes.STRING, allowNull: false },
    file_url: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    status: { 
      type: DataTypes.STRING, 
      allowNull: false,
      validate: {
        isIn: [["Pending", "Paid", "Overdue"]]
      }
    },
    partner_id: { 
      type: DataTypes.STRING(45), 
      allowNull: false,
    }
  }, {
    sequelize,
    modelName: 'Invoice',
  });

  return Invoice;
};
