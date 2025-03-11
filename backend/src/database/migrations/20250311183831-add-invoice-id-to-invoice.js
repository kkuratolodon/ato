'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Invoice', 'invoice_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'id'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Invoice', 'invoice_id');
  }
};