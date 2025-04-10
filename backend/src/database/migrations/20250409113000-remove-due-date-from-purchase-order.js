'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn('PurchaseOrder', 'due_date');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('PurchaseOrder', 'due_date', {
      type: Sequelize.DATE,
      allowNull: true
    });
  }
};