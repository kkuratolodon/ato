'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Invoice', 'currency_symbol', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'purchase_order_id' 
    });
    await queryInterface.addColumn('Invoice', 'currency_code', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'purchase_order_id'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Invoice', 'currency_symbol');
    await queryInterface.removeColumn('Invoice', 'currency_code');
  }
};