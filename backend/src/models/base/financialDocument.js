'use strict';
const { Model } = require('sequelize');
const DocumentStatus = require('../enums/documentStatus');


/**
 * Base class for financial documents (Invoice, PurchaseOrder)
 * This is a mapped superclass (not an entity itself)
 */
class FinancialDocument extends Model {
  static associate(models) {
    if (this.name === 'FinancialDocument') return; // Skip associations for the base class
    
    models?.Partner && this.belongsTo(models.Partner, {
      foreignKey: 'partner_id',
      targetKey: 'uuid',
      as: 'partner'
    });

    models?.Customer && this.belongsTo(models.Customer, {
      foreignKey: 'customer_id',
      targetKey: 'uuid',
      as: 'customer'
    });

    models?.Vendor && this.belongsTo(models.Vendor, {
      foreignKey: 'vendor_id',
      targetKey: 'uuid',
      as: 'vendor'
    });

    models?.Item && this.belongsToMany(models.Item, {
      through: 'FinancialDocumentItem',
      foreignKey: 'document_id',
      otherKey: 'item_id',
      as: 'items',
      onDelete: 'CASCADE'
    });
  }

  static init(attributes, options) {
    // Common fields for all financial documents
    const commonFields = {
      due_date: {
        type: options.DataTypes.DATE,
        allowNull: true
      },
      total_amount: {
        type: options.DataTypes.DECIMAL,
        allowNull: true,
        validate: {
          min: 0
        }
      },
      currency_symbol: {
        type: options.DataTypes.STRING,
        allowNull: true,
        defaultValue: '$'
      },
      currency_code: {
        type: options.DataTypes.STRING,
        allowNull: true,
        defaultValue: 'AUD'
      },
      subtotal_amount: {
        type: options.DataTypes.DECIMAL,
        allowNull: true
      },
      discount_amount: {
        type: options.DataTypes.DECIMAL,
        allowNull: true
      },
      tax_amount: {
        type: options.DataTypes.DECIMAL,
        allowNull: true
      },
      payment_terms: {
        type: options.DataTypes.STRING,
        allowNull: true
      },
      file_url: {
        type: options.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      },
      analysis_json_url: {
        type: options.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      },
      status: {
        type: options.DataTypes.ENUM(Object.values(DocumentStatus)),
        allowNull: false,
        defaultValue: DocumentStatus.PROCESSING,
        validate: {
          isIn: {
            args: [Object.values(DocumentStatus)],
            msg: "status must be one of 'Processing', 'Analyzed', or 'Failed'"
          }
        }
      },
      partner_id: {
        type: options.DataTypes.STRING(45),
        allowNull: false,
        defaultValue: null
      },
      customer_id: {
        type: options.DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Customer',
          key: 'uuid'
        },
        defaultValue: null
      },
      vendor_id: {
        type: options.DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Vendor',
          key: 'uuid'
        },
        defaultValue: null
      }
    };

    // Merge common fields with entity-specific fields
    const mergedAttributes = { ...commonFields, ...attributes };

    // Call the original init with merged attributes
    super.init(mergedAttributes, options);
  }
}

module.exports = FinancialDocument;