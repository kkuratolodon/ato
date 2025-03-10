'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Tambahkan customer_id ke tabel Invoice
    await queryInterface.addColumn('Invoice', 'customer_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Customer',
        key: 'uuid'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Tambahkan customer_id ke tabel PurchaseOrder
    await queryInterface.addColumn('PurchaseOrder', 'customer_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Customer',
        key: 'uuid'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Invoice', 'customer_id');
    await queryInterface.removeColumn('PurchaseOrder', 'customer_id');
  }
};