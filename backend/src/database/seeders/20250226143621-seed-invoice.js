'use strict';
const { faker } = require('@faker-js/faker');

module.exports = {
  async up(queryInterface) {
    const invoices = [];

    for (let i = 0; i < 10; i++) { // Menambahkan 10 data random
      invoices.push({
        invoice_date: faker.date.past(),
        due_date: faker.date.future(),
        purchase_order_id: faker.number.int({ min: 100, max: 999 }),
        total_amount: faker.finance.amount(500, 5000, 2),
        subtotal_amount: faker.finance.amount(400, 4500, 2),
        discount_amount: faker.finance.amount(0, 500, 2),
        payment_terms: faker.helpers.arrayElement(['Net 7', 'Net 10', 'Net 30']),
        file_url: faker.internet.url(),
        status: faker.helpers.arrayElement(['pending', 'approved', 'rejected']),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await queryInterface.bulkInsert('Invoice', invoices);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Invoice', null, {});
  }
};
