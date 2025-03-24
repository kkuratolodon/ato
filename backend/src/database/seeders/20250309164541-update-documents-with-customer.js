'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // 1. Periksa nama tabel yang benar (case sensitive di beberapa database)
      const tables = await queryInterface.showAllTables();
      const invoiceTableName = tables.find(t => t.toLowerCase() === 'invoice');
      const poTableName = tables.find(t => t.toLowerCase() === 'purchase_order');
      const customerTableName = tables.find(t => t.toLowerCase() === 'customer');
      
      if (!customerTableName) {
        console.log('Customer table not found, skipping document update.');
        return;
      }
      
      // 2. Get customer UUIDs
      const customers = await queryInterface.sequelize.query(
        `SELECT uuid FROM ${customerTableName};`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      if (customers.length === 0) {
        console.log('No customers found, skipping document update.');
        return;
      }
      
      // 3. Update Invoice if table exists
      if (invoiceTableName) {
        // Gunakan parameterized query untuk menghindari SQL injection
        const invoices = await queryInterface.sequelize.query(
          `SELECT id FROM ${invoiceTableName};`,
          { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        
        console.log(`Found ${invoices.length} invoices to update with customer_id`);
        
        for (const invoice of invoices) {
          const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
          await queryInterface.sequelize.query(
            `UPDATE ${invoiceTableName} SET customer_id = ? WHERE id = ?`,
            {
              replacements: [randomCustomer.uuid, invoice.id],
              type: queryInterface.sequelize.QueryTypes.UPDATE
            }
          );
        }
        console.log(`Updated ${invoices.length} invoices with customer_id`);
      } else {
        console.log('Invoice table not found, skipping invoice update.');
      }
      
      // 4. Update PurchaseOrder if table exists
      if (poTableName) {
        const purchaseOrders = await queryInterface.sequelize.query(
          `SELECT id FROM ${poTableName};`,
          { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        
        console.log(`Found ${purchaseOrders.length} purchase orders to update with customer_id`);
        
        for (const po of purchaseOrders) {
          const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
          await queryInterface.sequelize.query(
            `UPDATE ${poTableName} SET customer_id = ? WHERE id = ?`,
            {
              replacements: [randomCustomer.uuid, po.id],
              type: queryInterface.sequelize.QueryTypes.UPDATE
            }
          );
        }
        console.log(`Updated ${purchaseOrders.length} purchase orders with customer_id`);
      } else {
        console.log('PurchaseOrder table not found, skipping purchase order update.');
      }
      
      console.log('Document update with customer_id completed successfully');
    } catch (error) {
      console.error('Error updating documents with customer_id:', error);
      throw error;
    }
  },

  down: async (queryInterface) => {
    try {
      // Case-insensitive table name check
      const tables = await queryInterface.showAllTables();
      const invoiceTableName = tables.find(t => t.toLowerCase() === 'invoice');
      const poTableName = tables.find(t => t.toLowerCase() === 'purchase_order');
      
      if (invoiceTableName) {
        await queryInterface.sequelize.query(
          `UPDATE ${invoiceTableName} SET customer_id = NULL`,
          { type: queryInterface.sequelize.QueryTypes.UPDATE }
        );
        console.log(`Reset customer_id to NULL for all invoices`);
      }
      
      if (poTableName) {
        await queryInterface.sequelize.query(
          `UPDATE ${poTableName} SET customer_id = NULL`,
          { type: queryInterface.sequelize.QueryTypes.UPDATE }
        );
        console.log(`Reset customer_id to NULL for all purchase orders`);
      }
      
      console.log('Successfully reverted customer_id updates');
    } catch (error) {
      console.error('Error reverting customer_id updates:', error);
      throw error;
    }
  }
};