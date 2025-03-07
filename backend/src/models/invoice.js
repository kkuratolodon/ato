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
    invoice_date: { 
      type: DataTypes.DATE, 
      allowNull: false 
    },
    due_date: { 
      type: DataTypes.DATE, 
      allowNull: false,
      validate: {
        isAfterInvoiceDate(value) {
          if (this.invoice_date && new Date(value) < new Date(this.invoice_date)) {
            throw new Error('due_date must not be earlier than invoice_date');
          }
        }
      }
    },
    purchase_order_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      validate: {
        isInt: {
          msg: "purchase_order_id must be an integer"
        }
      }
    },
    total_amount: { 
      type: DataTypes.DECIMAL, 
      allowNull: false,
      validate: {
        min: 0,
      }
    },
    subtotal_amount: { 
      type: DataTypes.DECIMAL, 
      allowNull: false 
    },
    discount_amount: { 
      type: DataTypes.DECIMAL, 
      allowNull: true 
    },
    payment_terms: { 
      type: DataTypes.STRING, 
      allowNull: false 
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
          args: [["Pending", "Paid", "Overdue"]],
          msg: "status must be one of 'Pending', 'Paid', or 'Overdue'"
        }
      }
    },
    partner_id: { 
      type: DataTypes.STRING(45), 
      allowNull: false,
    }
  }, {
    sequelize,
    modelName: 'Invoice',
    tableName: 'Invoice',
    freezeTableName: true
  });

  return Invoice;
};
