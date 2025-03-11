'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Invoice', 'vendor_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Vendor',
        key: 'uuid'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('PurchaseOrder', 'vendor_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Vendor',
        key: 'uuid'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Invoice', 'vendor_id');
    await queryInterface.removeColumn('PurchaseOrder', 'vendor_id');
  }
};