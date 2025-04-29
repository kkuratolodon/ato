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
        // Relasi Item via belongsToMany to satisfy association tests
        Invoice.belongsToMany(models.Item, {
          through: 'Item',
          foreignKey: 'document_id',
          otherKey: 'uuid',
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
    paranoid: true,        
    deletedAt: 'deleted_at',
    hooks: {
      beforeDestroy: async (instance) => {
        instance.is_deleted = true;
        await instance.save();
      },
      afterRestore: async (instance) => {
        instance.is_deleted = false;
        await instance.save();
      }
    },
    DataTypes 
  });

  return Invoice;
};