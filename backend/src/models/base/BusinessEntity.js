'use strict';
const { Model } = require('sequelize');

/**
 * Base class for business entities (Customer, Vendor)
 * This is a mapped superclass (not an entity itself)
 */

class BusinessEntity extends Model {
    static init(attributes, options) {
        // Add common fields to the attributes
        const addressFields = {
            street_address: {
                type: options.DataTypes.TEXT,
                allowNull: true
            },
            city: {
                type: options.DataTypes.STRING(100),
                allowNull: true
            },
            state: {
                type: options.DataTypes.STRING(100),
                allowNull: true
            },
            postal_code: {
                type: options.DataTypes.STRING(20),
                allowNull: true
            },
            house: {
                type: options.DataTypes.STRING(100),
                allowNull: true
            }
        };

        const commonFields = {
            uuid: {
                type: options.DataTypes.UUID,
                defaultValue: options.DataTypes.UUIDV4,
                primaryKey: true
            },
            name: {
                type: options.DataTypes.STRING,
                allowNull: true
            },
            ...addressFields,
            tax_id: {
                type: options.DataTypes.STRING,
                allowNull: true
            },
            recipient_name: {
                type: options.DataTypes.STRING,
                allowNull: true
            },
        };

        // Merge common fields with entity-specific fields
        const mergedAttributes = { ...commonFields, ...attributes };

        // Call the actual init method with merged attributes
        super.init(mergedAttributes, options);
    }
}

module.exports = BusinessEntity;