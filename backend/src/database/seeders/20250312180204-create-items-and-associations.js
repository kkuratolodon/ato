'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    try {
      // First, create some items if they don't exist yet
      const existingItems = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM Item;',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      if (existingItems[0].count === 0) {
        // Create some items first
        const items = [
          {
            uuid: uuidv4(),
            description: 'Ergonomic executive chair with adjustable height',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            uuid: uuidv4(),
            description: '15-inch laptop with Intel i7, 16GB RAM, 512GB SSD',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            uuid: uuidv4(),
            description: 'Bundle including stapler, paper clips, pens, and notepads',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            uuid: uuidv4(),
            description: 'Annual subscription for office productivity software',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
        await queryInterface.bulkInsert('Item', items, {});
      }
      
      // Get invoice IDs
      const invoices = await queryInterface.sequelize.query(
        'SELECT id FROM Invoice;',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      // Get purchase order IDs
      const purchaseOrders = await queryInterface.sequelize.query(
        'SELECT id FROM PurchaseOrder;',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      // Get the items with their UUIDs
      const items = await queryInterface.sequelize.query(
        'SELECT uuid FROM Item;',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      console.log(`Found ${invoices.length} invoices, ${purchaseOrders.length} POs, and ${items.length} items`);
      
      // Create associations using the correct field names
      const associations = [];
      
      // Associate items with invoices
      for (const invoice of invoices) {
        const randomItem = items[Math.floor(Math.random() * items.length)];
        
        associations.push({
          document_type: 'Invoice',
          document_id: invoice.id,
          item_id: randomItem.uuid,
          quantity: Math.floor(Math.random() * 5) + 1,
          unit_price: (Math.random() * 100 + 50).toFixed(2),
          amount: (Math.random() * 500 + 100).toFixed(2),
          // REMOVED: unit field which doesn't exist in the table!
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Associate items with purchase orders
      for (const po of purchaseOrders) {
        const randomItem = items[Math.floor(Math.random() * items.length)];
        
        associations.push({
          document_type: 'PurchaseOrder',
          document_id: po.id,
          item_id: randomItem.uuid,
          quantity: Math.floor(Math.random() * 5) + 1,
          unit_price: (Math.random() * 100 + 50).toFixed(2),
          amount: (Math.random() * 500 + 100).toFixed(2),
          // REMOVED: unit field which doesn't exist in the table!
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Insert the associations
      console.log(`Inserting ${associations.length} item associations...`);
      
      for (let i = 0; i < associations.length; i++) {
        try {
          await queryInterface.bulkInsert('FinancialDocumentItem', [associations[i]], {});
          console.log(`Inserted association ${i+1}/${associations.length}`);
        } catch (error) {
          console.error(`Error inserting association ${i+1}:`, error.message);
          console.log('Problematic record:', JSON.stringify(associations[i], null, 2));
        }
      }
      
      console.log('Seeding completed successfully');
    } catch (error) {
      console.error('Error during seeding:', error.message);
      throw error;
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('FinancialDocumentItem', null, {});
  }
};