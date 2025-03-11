'use strict';

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

    const invoices = partners.flatMap(partner => ([
      {
        invoice_id: `INV-${1001 + (index * 2)}`,
        invoice_date: new Date('2024-01-01'),
        due_date: new Date('2024-02-01'),
        purchase_order_id: 1001,
        total_amount: 1500.00,
        subtotal_amount: 1600.00,
        discount_amount: 100.00,
        payment_terms: "Net 30",
        file_url: "https://example.com/invoice1.pdf",
        status: "Analyzed",
        partner_id: partner.uuid,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        invoice_id: `INV-${1001 + (index * 2)}`,
        invoice_date: new Date('2024-02-01'),
        due_date: new Date('2024-03-01'),
        purchase_order_id: 1002,
        total_amount: 2500.00,
        subtotal_amount: 2500.00,
        discount_amount: 0.00,
        payment_terms: "Net 30",
        file_url: "https://example.com/invoice2.pdf",
        status: "Processing",
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