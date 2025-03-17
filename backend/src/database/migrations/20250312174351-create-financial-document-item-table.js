'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the existing table first
    await queryInterface.dropTable('FinancialDocumentItem', { cascade: true }).catch(() => {
      console.log('Table does not exist yet, creating new one');
    });

    await queryInterface.createTable('FinancialDocumentItem', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      document_type: {
        type: Sequelize.STRING(20), 
        allowNull: false,
        comment: 'Type of document (Invoice or PurchaseOrder)'
      },
      document_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'UUID of either Invoice or PurchaseOrder'
        // We can't reference FinancialDocument directly as it's an abstract model
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Item',
          key: 'uuid'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      quantity: {
        type: Sequelize.DECIMAL,
        allowNull: true
      },
      unit: {
        type: Sequelize.STRING,
        allowNull: true
      },
      unit_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
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

    // Create indexes for faster lookups
    await queryInterface.addIndex('FinancialDocumentItem', ['document_type', 'document_id']);
    await queryInterface.addIndex('FinancialDocumentItem', ['item_id']);
    
    // Add compound unique index to prevent duplicate associations
    await queryInterface.addIndex('FinancialDocumentItem', 
      ['document_type', 'document_id', 'item_id'], 
      { unique: true }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('FinancialDocumentItem');
  }
};