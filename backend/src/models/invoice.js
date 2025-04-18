'use strict';
const FinancialDocument = require('./base/financialDocument');

module.exports = (sequelize, DataTypes) => {
  class Invoice extends FinancialDocument {
    static associate(models) {
      if (!models) return;
      
      if (models.Partner) {
        Invoice.belongsTo(models.Partner, { 
          foreignKey: 'partner_id', 
          targetKey: 'uuid',
          as: 'partner'
        });
      }
      
      if (models.Customer) {
        Invoice.belongsTo(models.Customer, { 
          foreignKey: 'customer_id', 
          targetKey: 'uuid',
          as: 'customer'
        });
      }
      
      if (models.Vendor) {
        Invoice.belongsTo(models.Vendor, { 
          foreignKey: 'vendor_id', 
          targetKey: 'uuid',
          as: 'vendor'
        });
      }

      if (models.Item) {
        Invoice.belongsToMany(models.Item, {
          through: 'FinancialDocumentItem',
          foreignKey: 'document_id',
          otherKey: 'item_id',
          as: 'items'
        });
      }
    }
  }

  Invoice.init({
    invoice_number: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    invoice_date: { 
      type: DataTypes.DATE, 
      allowNull: true 
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterInvoiceDate(value) {
          if (this.invoice_date && new Date(value) < new Date(this.invoice_date)) {
            throw new Error('due_date must not be earlier than invoice_date');
          }
        }
      }
    },
    purchase_order_id: { 
      type: DataTypes.STRING(100), 
      allowNull: true,
    }
  }, {
    sequelize,
    modelName: 'Invoice',
    tableName: 'Invoice',
    freezeTableName: true,
    DataTypes 
  });

  return Invoice;
};