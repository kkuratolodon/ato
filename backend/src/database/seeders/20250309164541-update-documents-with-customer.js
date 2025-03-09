'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get customer UUIDs
    const customers = await queryInterface.sequelize.query(
      'SELECT uuid FROM Customer;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    if (customers.length === 0) {
      console.log('No customers found, skipping document update.');
      return;
    }
    
    // Update Invoice
    const invoices = await queryInterface.sequelize.query(
      'SELECT id FROM Invoice;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    for (const invoice of invoices) {
      const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
      await queryInterface.sequelize.query(
        `UPDATE Invoice SET customer_id = '${randomCustomer.uuid}' WHERE id = ${invoice.id}`
      );
    }
    
    // Update PurchaseOrder
    const purchaseOrders = await queryInterface.sequelize.query(
      'SELECT id FROM PurchaseOrder;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    for (const po of purchaseOrders) {
      const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
      await queryInterface.sequelize.query(
        `UPDATE PurchaseOrder SET customer_id = '${randomCustomer.uuid}' WHERE id = ${po.id}`
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('UPDATE Invoice SET customer_id = NULL');
    await queryInterface.sequelize.query('UPDATE PurchaseOrder SET customer_id = NULL');
  }
};