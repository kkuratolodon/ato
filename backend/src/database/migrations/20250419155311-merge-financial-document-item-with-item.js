'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    try {
      // Menambahkan kolom-kolom baru ke tabel Item yang sudah ada
      await queryInterface.addColumn('Item', 'document_id', {
        type: Sequelize.UUID,  // Menggunakan UUID bukan INTEGER
        allowNull: true
      });
      
      await queryInterface.addColumn('Item', 'document_type', {
        type: Sequelize.STRING,
        allowNull: true
      });
      
      await queryInterface.addColumn('Item', 'quantity', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
      
      await queryInterface.addColumn('Item', 'unit', {
        type: Sequelize.STRING,
        allowNull: true
      });
      
      await queryInterface.addColumn('Item', 'unit_price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      });
      
      await queryInterface.addColumn('Item', 'amount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      });

      // Tambahkan indeks untuk pencarian yang lebih cepat
      await queryInterface.addIndex('Item', ['document_id', 'document_type']);
      
      console.log('Successfully added FinancialDocumentItem columns to Item table');
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down (queryInterface) {
    try {
      // Hapus kolom-kolom yang ditambahkan
      await queryInterface.removeColumn('Item', 'document_id');
      await queryInterface.removeColumn('Item', 'document_type');
      await queryInterface.removeColumn('Item', 'quantity');
      await queryInterface.removeColumn('Item', 'unit');
      await queryInterface.removeColumn('Item', 'unit_price');
      await queryInterface.removeColumn('Item', 'amount');
      
      console.log('Successfully removed added columns from Item table');
    } catch (error) {
      console.error('Error in down migration:', error);
      throw error;
    }
  }
};