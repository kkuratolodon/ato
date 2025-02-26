'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Invoice', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      invoice_date: {
        type: Sequelize.DATE
      },
      due_date: {
        type: Sequelize.DATE
      },
      purchase_order_id: {
        type: Sequelize.INTEGER
      },
      total_amount: {
        type: Sequelize.DECIMAL
      },
      subtotal_amount: {
        type: Sequelize.DECIMAL
      },
      discount_amount: {
        type: Sequelize.DECIMAL
      },
      payment_terms: {
        type: Sequelize.STRING
      },
      file_url: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Invoice');
  }
};