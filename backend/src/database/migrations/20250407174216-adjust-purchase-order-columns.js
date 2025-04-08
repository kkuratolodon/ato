'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add currency and analysis_json_url columns
    await queryInterface.addColumn('purchaseorder', 'currency_symbol', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    
    await queryInterface.addColumn('purchaseorder', 'currency_code', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    
    await queryInterface.addColumn('purchaseorder', 'analysis_json_url', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    
    // Modify id column to be CHAR(36) CHARACTER SET ascii
    await queryInterface.changeColumn('purchaseorder', 'id', {
      type: Sequelize.CHAR(36),
      charset: 'ascii'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove added columns
    await queryInterface.removeColumn('purchaseorder', 'currency_symbol');
    await queryInterface.removeColumn('purchaseorder', 'currency_code');
    await queryInterface.removeColumn('purchaseorder', 'analysis_json_url');
    
    // Revert id column back to its original type (assuming it was STRING)
    await queryInterface.changeColumn('purchaseorder', 'id', {
      type: Sequelize.STRING
    });
  }
};
