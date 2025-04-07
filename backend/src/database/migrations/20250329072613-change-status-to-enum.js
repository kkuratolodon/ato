'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, change existing values to match the enum case exactly
    const updateQueries = [
      "UPDATE `Invoice` SET status = 'Processing' WHERE status = 'processing'",
      "UPDATE `Invoice` SET status = 'Analyzed' WHERE status = 'analyzed'",
      "UPDATE `Invoice` SET status = 'Failed' WHERE status = 'failed'",
      "UPDATE `PurchaseOrder` SET status = 'Processing' WHERE status = 'processing'",
      "UPDATE `PurchaseOrder` SET status = 'Analyzed' WHERE status = 'analyzed'",
      "UPDATE `PurchaseOrder` SET status = 'Failed' WHERE status = 'failed'"
    ];

    // Execute each query separately to handle errors better
    for (const query of updateQueries) {
      try {
        await queryInterface.sequelize.query(query);
      } catch (error) {
        console.log(`Skipping query due to error: ${query}`);
        // Continue with other queries even if one fails
      }
    }

    // Then change the column type to ENUM
    try {
      await queryInterface.changeColumn('Invoice', 'status', {
        type: Sequelize.ENUM('Processing', 'Analyzed', 'Failed'),
        allowNull: false,
        defaultValue: 'Processing'
      });
    } catch (error) {
      console.log('Skipping Invoice status change:', error.message);
    }

    try {
      await queryInterface.changeColumn('PurchaseOrder', 'status', {
        type: Sequelize.ENUM('Processing', 'Analyzed', 'Failed'),
        allowNull: false,
        defaultValue: 'Processing'
      });
    } catch (error) {
      console.log('Skipping PurchaseOrder status change:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // First remove the ENUM type constraint
    try {
      await queryInterface.changeColumn('Invoice', 'status', {
        type: Sequelize.STRING,
        allowNull: false
      });
    } catch (error) {
      console.log('Skipping Invoice status revert:', error.message);
    }

    try {
      await queryInterface.changeColumn('PurchaseOrder', 'status', {
        type: Sequelize.STRING,
        allowNull: false
      });
    } catch (error) {
      console.log('Skipping PurchaseOrder status revert:', error.message);
    }
  }
};