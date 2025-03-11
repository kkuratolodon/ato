'use strict';

module.exports = {
  up: async (queryInterface) => {
    // Get vendor UUIDs
    const vendors = await queryInterface.sequelize.query(
      'SELECT uuid FROM Vendor;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (vendors.length === 0) {
      console.log('No vendors found, skipping document update.');
      return;
    }

    // Update Invoice
    const invoices = await queryInterface.sequelize.query(
      'SELECT id FROM Invoice;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const invoice of invoices) {
      const randomVendor = vendors[Math.floor(Math.random() * vendors.length)];
      await queryInterface.sequelize.query(
        `UPDATE Invoice SET vendor_id = '${randomVendor.uuid}' WHERE id = ${invoice.id}`
      );
    }

    // Update PurchaseOrder
    const purchaseOrders = await queryInterface.sequelize.query(
      'SELECT id FROM PurchaseOrder;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const po of purchaseOrders) {
      const randomVendor = vendors[Math.floor(Math.random() * vendors.length)];
      await queryInterface.sequelize.query(
        `UPDATE PurchaseOrder SET vendor_id = '${randomVendor.uuid}' WHERE id = ${po.id}`
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('UPDATE Invoice SET vendor_id = NULL');
    await queryInterface.sequelize.query('UPDATE PurchaseOrder SET vendor_id = NULL');
  }
};