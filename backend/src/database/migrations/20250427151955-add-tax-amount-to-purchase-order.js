'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('PurchaseOrder', 'tax_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('PurchaseOrder', 'tax_amount');
  }
};
