'use strict';
const { Model } = require('sequelize');
const DocumentStatus = require('../enums/DocumentStatus');


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

    // Handle Item association for many-to-many
    models?.Item && this.belongsToMany(models.Item, {
      through: 'Item',
      foreignKey: 'document_id',
      otherKey: 'uuid',
      as: 'items'
    });
  }

  static init(attributes, options) {
    // UUID as primary key for all financial documents
    const commonFields = {
      id: {
        type: options.DataTypes.UUID,
        defaultValue: options.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
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
        defaultValue: null
      },
      currency_code: {
        type: options.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
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
            msg: `status must be one of: ${Object.values(DocumentStatus).join(', ')}`
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
      },
      is_deleted: {
        type: options.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      deleted_at: {
        type: options.DataTypes.DATE,
        allowNull: true,
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