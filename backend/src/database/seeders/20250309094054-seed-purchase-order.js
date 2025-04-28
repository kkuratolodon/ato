'use strict';
const { v4: uuidv4 } = require('uuid');
const DocumentStatus = require('../../models/enums/DocumentStatus');

module.exports = {
  up: async (queryInterface) => {
    const partners = await queryInterface.sequelize.query(
      'SELECT uuid FROM partner LIMIT 3;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!partners.length) {
      console.log('No partners found. Please run partner seeds first.');
      return;
    }

    const purchaseOrders = partners.flatMap(partner => ([
      {
        id: uuidv4(),
        po_number: 'PO-2024-001', 
        po_date: new Date('2024-01-01'),
        total_amount: 5000.00,
        subtotal_amount: 5200.00,
        discount_amount: 200.00,
        payment_terms: "Net 30",
        file_url: "https://example.com/purchase_orders/po1.pdf",
        status: DocumentStatus.ANALYZED,
        partner_id: partner.uuid,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        po_number: 'PO-2024-002',
        po_date: new Date('2024-02-15'),
        total_amount: 3500.00,
        subtotal_amount: 3700.00,
        discount_amount: 200.00,
        payment_terms: "Net 45",
        file_url: "https://example.com/purchase_orders/po2.pdf",
        status: DocumentStatus.PROCESSING,
        partner_id: partner.uuid,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]));

    return queryInterface.bulkInsert('PurchaseOrder', purchaseOrders, {});
  },

  down: async (queryInterface) => {
    return queryInterface.bulkDelete('PurchaseOrder', null, {});
  }
};