'use strict';

module.exports = {
  async up(queryInterface, _Sequelize) {
    try {
      // 1. Periksa tipe data kolom uuid di tabel Item
      const [itemColResults] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM Item WHERE Field='uuid'"
      );
      console.log(`Item.uuid column type: ${JSON.stringify(itemColResults[0])}`);
      
      // 2. Buat tabel tanpa foreign key constraints
      await queryInterface.createTable('FinancialDocumentItem', {
        id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          defaultValue: Sequelize.literal('(UUID())'),
          allowNull: false
        },
        document_id: {
          type: Sequelize.CHAR(36),
          allowNull: false
          // Hapus referensi foreign key
        },
        document_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        item_id: {
          type: Sequelize.CHAR(36),
          allowNull: false
          // Hapus referensi foreign key
        },
        quantity: {
          type: Sequelize.DECIMAL(10, 2),
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
          type: Sequelize.DATE,
          allowNull: false
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });

      console.log('Table FinancialDocumentItem created successfully without foreign keys');

    } catch (error) {
      console.error('Error creating FinancialDocumentItem table:', error);
      throw error;
    }
  },

  async down(queryInterface, _Sequelize) {
    try {
      await queryInterface.dropTable('FinancialDocumentItem');
      console.log('FinancialDocumentItem table dropped');
    } catch (error) {
      console.error('Error dropping FinancialDocumentItem table:', error);
    }
  }
};