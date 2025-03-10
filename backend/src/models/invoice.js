'use strict';
const FinancialDocumentFactory = require('./financialDocument');

module.exports = (sequelize, DataTypes) => {
  const FinancialDocument = FinancialDocumentFactory(sequelize, DataTypes);
  
  class Invoice extends FinancialDocument {
    static associate(models) {
      if (!models) return;
      
      Invoice.belongsTo(models.Partner, { 
        foreignKey: 'partner_id', 
        targetKey: 'uuid',
        as: 'partner'
      });
      
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
    }
  }

  const financialDocAttributes = { ...FinancialDocument.getAttributes() };
  delete financialDocAttributes.id;
  delete financialDocAttributes.createdAt;
  delete financialDocAttributes.updatedAt;

  Invoice.init({
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
    },
    ...Object.fromEntries(
      Object.entries(financialDocAttributes)
        .filter(([key]) => !['due_date'].includes(key))
    )
  }, {
    sequelize,
    modelName: 'Invoice',
    tableName: 'Invoice',
    freezeTableName: true
  });

  return Invoice;
};