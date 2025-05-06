'use strict';

module.exports = {
  up: async (queryInterface) => {
    try {
      // 1. Check for correct table names (case sensitive in some databases)
      const tables = await queryInterface.showAllTables();
      const invoiceTableName = tables.find(t => t.toLowerCase() === 'invoice');
      const poTableName = tables.find(t => t.toLowerCase() === 'purchase_order');
      const vendorTableName = tables.find(t => t.toLowerCase() === 'vendor');
      
      if (!vendorTableName) {
        console.log('Vendor table not found, skipping document update.');
        return;
      }
      
      // 2. Get vendor UUIDs using the correct table name
      const vendors = await queryInterface.sequelize.query(
        `SELECT uuid FROM ${vendorTableName};`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      if (vendors.length === 0) {
        console.log('No vendors found, skipping document update.');
        return;
      }
      
      // 3. Update Invoice if table exists
      if (invoiceTableName) {
        const invoices = await queryInterface.sequelize.query(
          `SELECT id FROM ${invoiceTableName};`,
          { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        
        console.log(`Found ${invoices.length} invoices to update with vendor_id`);
        
        for (const invoice of invoices) {
          const randomVendor = vendors[Math.floor(Math.random() * vendors.length)];
          await queryInterface.sequelize.query(
            `UPDATE ${invoiceTableName} SET vendor_id = ? WHERE id = ?`,
            {
              replacements: [randomVendor.uuid, invoice.id],
              type: queryInterface.sequelize.QueryTypes.UPDATE
            }
          );
        }
        console.log(`Updated ${invoices.length} invoices with vendor_id`);
      } else {
        console.log('Invoice table not found, skipping invoice update.');
      }
      
      // 4. Update PurchaseOrder if table exists
      if (poTableName) {
        const purchaseOrders = await queryInterface.sequelize.query(
          `SELECT id FROM ${poTableName};`,
          { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        
        console.log(`Found ${purchaseOrders.length} purchase orders to update with vendor_id`);
        
        for (const po of purchaseOrders) {
          const randomVendor = vendors[Math.floor(Math.random() * vendors.length)];
          await queryInterface.sequelize.query(
            `UPDATE ${poTableName} SET vendor_id = ? WHERE id = ?`,
            {
              replacements: [randomVendor.uuid, po.id],
              type: queryInterface.sequelize.QueryTypes.UPDATE
            }
          );
        }
        console.log(`Updated ${purchaseOrders.length} purchase orders with vendor_id`);
      } else {
        console.log('PurchaseOrder table not found, skipping purchase order update.');
      }
      
      console.log('Document update with vendor_id completed successfully');
    } catch (error) {
      console.error('Error updating documents with vendor_id:', error);
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
          `UPDATE ${invoiceTableName} SET vendor_id = NULL`,
          { type: queryInterface.sequelize.QueryTypes.UPDATE }
        );
        console.log(`Reset vendor_id to NULL for all invoices`);
      }
      
      if (poTableName) {
        await queryInterface.sequelize.query(
          `UPDATE ${poTableName} SET vendor_id = NULL`,
          { type: queryInterface.sequelize.QueryTypes.UPDATE }
        );
        console.log(`Reset vendor_id to NULL for all purchase orders`);
      }
      
      console.log('Successfully reverted vendor_id updates');
    } catch (error) {
      console.error('Error reverting vendor_id updates:', error);
      throw error;
    }
  }
};