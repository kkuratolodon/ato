'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Invoice', 'total_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.changeColumn('Invoice', 'subtotal_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.changeColumn('Invoice', 'discount_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Invoice', 'total_amount', {
      type: Sequelize.DECIMAL,
      allowNull: true,
    });
    await queryInterface.changeColumn('Invoice', 'subtotal_amount', {
      type: Sequelize.DECIMAL,
      allowNull: true,
    });
    await queryInterface.changeColumn('Invoice', 'discount_amount', {
      type: Sequelize.DECIMAL,
      allowNull: true,
    });
  }
};