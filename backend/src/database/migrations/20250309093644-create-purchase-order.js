'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('PurchaseOrder', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      po_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      po_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      due_date: { 
        type: Sequelize.DATE, 
        allowNull: true
      },
      total_amount: { 
        type: Sequelize.DECIMAL(10, 2), 
        allowNull: true
      },
      subtotal_amount: { 
        type: Sequelize.DECIMAL(10, 2), 
        allowNull: true 
      },
      discount_amount: { 
        type: Sequelize.DECIMAL(10, 2), 
        allowNull: true 
      },
      payment_terms: { 
        type: Sequelize.STRING, 
        allowNull: true 
      },
      file_url: { 
        type: Sequelize.STRING, 
        allowNull: true,
        defaultValue: null
      },
      status: { 
        type: Sequelize.STRING, 
        allowNull: false,
        defaultValue: 'Processing'
      },
      partner_id: { 
        type: Sequelize.STRING(45), 
        allowNull: false,
        references: {
          model: 'Partner',
          key: 'uuid'
        }
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

  down: async (queryInterface) => {
    await queryInterface.dropTable('PurchaseOrder');
  }
};