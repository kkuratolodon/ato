'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add currency and analysis_json_url columns
    await queryInterface.addColumn('PurchaseOrder', 'currency_symbol', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    
    await queryInterface.addColumn('PurchaseOrder', 'currency_code', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    
    await queryInterface.addColumn('PurchaseOrder', 'analysis_json_url', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    
    // Modify id column to be CHAR(36) CHARACTER SET ascii
    await queryInterface.changeColumn('PurchaseOrder', 'id', {
      type: Sequelize.CHAR(36),
      charset: 'ascii'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove added columns
    await queryInterface.removeColumn('PurchaseOrder', 'currency_symbol');
    await queryInterface.removeColumn('PurchaseOrder', 'currency_code');
    await queryInterface.removeColumn('PurchaseOrder', 'analysis_json_url');
    
    // Revert id column back to its original type (assuming it was STRING)
    await queryInterface.changeColumn('PurchaseOrder', 'id', {
      type: Sequelize.STRING
    });
  }
};
