'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const vendors = [
      {
        uuid: uuidv4(),
        name: 'Acme Supply Co.',
        address: '123 Main Street, Los Angeles, CA 90001, Suite 101',
        recipient_name: 'John Smith',
        tax_id: '12-3456789',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        uuid: uuidv4(),
        name: 'TechParts Inc.',
        address: '456 Tech Boulevard, San Francisco, CA 94105, Floor 15',
        recipient_name: 'Sarah Johnson',
        tax_id: '98-7654321',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        uuid: uuidv4(),
        name: 'Global Manufacturing',
        address: '789 Industrial Way, Chicago, IL 60607',
        recipient_name: 'Robert Williams',
        tax_id: '45-6789012',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('Vendor', vendors, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Vendor', null, {});
  }
};