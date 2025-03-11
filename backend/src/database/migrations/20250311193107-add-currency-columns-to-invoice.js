'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Invoice', 'currency_symbol', {
      type: Sequelize.STRING,
      allowNull: true,
      before: 'total_amount' 
    });
    await queryInterface.addColumn('Invoice', 'currency_code', {
      type: Sequelize.STRING,
      allowNull: true,
      before: 'total_amount'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Invoice', 'currency_symbol');
    await queryInterface.removeColumn('Invoice', 'currency_code');
  }
};