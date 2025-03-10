'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const vendors = [
      {
        uuid: uuidv4(),
        name: 'Acme Supply Co.',
        street_address: '123 Main Street',
        city: 'Los Angeles',
        state: 'CA',
        postal_code: '90001',
        house: 'Suite 101',
        recipient_name: 'John Smith',
        tax_id: '12-3456789',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        uuid: uuidv4(),
        name: 'TechParts Inc.',
        street_address: '456 Tech Boulevard',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94105',
        house: 'Floor 15',
        recipient_name: 'Sarah Johnson',
        tax_id: '98-7654321',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        uuid: uuidv4(),
        name: 'Global Manufacturing',
        street_address: '789 Industrial Way',
        city: 'Chicago',
        state: 'IL',
        postal_code: '60607',
        house: null,
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