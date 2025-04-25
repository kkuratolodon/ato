'use strict';
const { v4: uuidv4 } = require('uuid');
const DocumentStatus = require('../../models/enums/DocumentStatus');

module.exports = {
  async up(queryInterface, _Sequelize) {
    // Create test partner
    await queryInterface.bulkInsert('Partner', [{
      uuid: 'test-partner-123',
      name: 'Test Partner',
      api_key: 'test-api-key-123',
      created_at: new Date(),
      updated_at: new Date()
    }]);

    // Create test invoice
    await queryInterface.bulkInsert('Invoice', [{
      id: uuidv4(),
      partner_id: 'test-partner-123',
      invoice_number: 'TEST-INV-001',
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 30*24*60*60*1000),
      status: DocumentStatus.ANALYZED,
      file_url: 'https://test-bucket.s3.amazonaws.com/test-invoice.pdf',
      created_at: new Date(),
      updated_at: new Date()
    }]);

    // Create test items
    await queryInterface.bulkInsert('Item', [{
      uuid: uuidv4(),
      document_type: 'Invoice',
      document_id: 'test-invoice-id',
      description: 'Test Item 1',
      quantity: 2,
      unit: 'pcs',
      unit_price: 100.00,
      amount: 200.00,
      created_at: new Date(),
      updated_at: new Date()
    }]);
  },

  async down(queryInterface, _Sequelize) {
    // Remove test data in reverse order
    await queryInterface.bulkDelete('Item', null, {});
    await queryInterface.bulkDelete('Invoice', null, {});
    await queryInterface.bulkDelete('Partner', null, {});
  }
};