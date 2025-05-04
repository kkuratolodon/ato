'use strict';
const { v4: uuidv4 } = require('uuid');
const DocumentStatus = require('@models/enums/DocumentStatus');

module.exports = {
  up: async (queryInterface) => {
    // First, get the partner UUIDs from the partner table
    const partners = await queryInterface.sequelize.query(
      'SELECT uuid FROM partner LIMIT 3;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!partners.length) {
      console.log('No partners found. Please run partner seeds first.');
      return;
    }

    const invoices = partners.flatMap((partner, index) => ([
      {
        id: uuidv4(),
        invoice_number: `INV-${1001 + (index * 2)}`,
        invoice_date: new Date('2024-01-01'),
        due_date: new Date('2024-02-01'),
        purchase_order_id: `PO-${1001 + (index * 2)}`, 
        total_amount: 1500.00,
        subtotal_amount: 1600.00,
        discount_amount: 100.00,
        payment_terms: "Net 30",
        file_url: "https://example.com/invoice1.pdf",
        analysis_json_url: "https://example.com/analysis/invoice1.json",
        status: DocumentStatus.ANALYZED,
        partner_id: partner.uuid,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        invoice_number: `INV-${1002 + (index * 2)}`,
        invoice_date: new Date('2024-02-01'),
        due_date: new Date('2024-03-01'),
        purchase_order_id: `PO-${1002 + (index * 2)}`,
        total_amount: 2500.00,
        subtotal_amount: 2500.00,
        discount_amount: 0.00,
        payment_terms: "Net 30",
        file_url: "https://example.com/invoice2.pdf",
        analysis_json_url: null, 
        status: DocumentStatus.PROCESSING,
        partner_id: partner.uuid,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]));

    return queryInterface.bulkInsert('Invoice', invoices, {});
  },

  down: async (queryInterface) => {
    return queryInterface.bulkDelete('Invoice', null, {});
  }
};