'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('PurchaseOrder', 'tax_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'discount_amount'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('PurchaseOrder', 'tax_amount');
  }
};