'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      await queryInterface.dropTable('FinancialDocumentItem');
      
      console.log('Successfully deleted FinancialDocumentItem table');
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Buat kembali tabel FinancialDocumentItem
      await queryInterface.createTable('FinancialDocumentItem', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        document_type: {
          type: Sequelize.STRING(20),
          allowNull: false
        },
        document_id: {
          type: Sequelize.UUID, // UUID bukan INTEGER
          allowNull: false
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
          type: Sequelize.INTEGER,
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
      
      await queryInterface.addIndex('FinancialDocumentItem', ['document_type', 'document_id']);
      await queryInterface.addIndex('FinancialDocumentItem', ['item_id']);
      
      console.log('Successfully recreated FinancialDocumentItem table');
      
    } catch (error) {
      console.error('Error in down migration:', error);
      throw error;
    }
  }
};