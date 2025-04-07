'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Cek keberadaan kolom pada tabel Invoice
      const invoiceColumns = await queryInterface.describeTable('Invoice');
      if (!invoiceColumns.analysis_json_url) {
        // Tambahkan kolom ke Invoice hanya jika belum ada
        await queryInterface.addColumn('Invoice', 'analysis_json_url', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: null
        });
        console.log('Added analysis_json_url column to Invoice table');
      } else {
        console.log('Column analysis_json_url already exists in Invoice table');
      }
      
      // Cek apakah tabel purchase_order ada
      try {
        // Cek keberadaan tabel purchase_order
        const purchaseOrderTable = await queryInterface.showAllTables()
          .then(tables => tables.find(table => table === 'purchase_order'));
          
        if (purchaseOrderTable) {
          // Cek keberadaan kolom pada tabel purchase_order
          const purchaseOrderColumns = await queryInterface.describeTable('purchase_order');
          if (!purchaseOrderColumns.analysis_json_url) {
            // Tambahkan kolom ke purchase_order hanya jika belum ada
            await queryInterface.addColumn('purchase_order', 'analysis_json_url', {
              type: Sequelize.STRING,
              allowNull: true,
              defaultValue: null
            });
            console.log('Added analysis_json_url column to purchase_order table');
          } else {
            console.log('Column analysis_json_url already exists in purchase_order table');
          }
        } else {
          console.log('purchase_order table does not exist');
        }
      } catch (error) {
        // Handle kasus dimana tabel purchase_order tidak ada
        console.log('Skipping purchase_order table:', error.message);
      }
      
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  down: async (queryInterface) => {
    try {
      // Cek keberadaan kolom pada tabel Invoice
      const invoiceColumns = await queryInterface.describeTable('Invoice');
      if (invoiceColumns.analysis_json_url) {
        // Hapus kolom dari Invoice hanya jika ada
        await queryInterface.removeColumn('Invoice', 'analysis_json_url');
        console.log('Removed analysis_json_url column from Invoice table');
      }
      
      // Cek apakah tabel purchase_order ada
      try {
        const purchaseOrderTable = await queryInterface.showAllTables()
          .then(tables => tables.find(table => table === 'purchase_order'));
          
        if (purchaseOrderTable) {
          // Cek keberadaan kolom pada tabel purchase_order
          const purchaseOrderColumns = await queryInterface.describeTable('purchase_order');
          if (purchaseOrderColumns.analysis_json_url) {
            // Hapus kolom dari purchase_order hanya jika ada
            await queryInterface.removeColumn('purchase_order', 'analysis_json_url');
            console.log('Removed analysis_json_url column from purchase_order table');
          }
        }
      } catch (error) {
        // Handle kasus dimana tabel purchase_order tidak ada
        console.log('Skipping purchase_order table:', error.message);
      }
      
    } catch (error) {
      console.error('Migration rollback error:', error);
      throw error;
    }
  }
};