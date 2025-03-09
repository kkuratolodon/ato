'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const customers = [
      {
        uuid: uuidv4(),
        name: 'PT Maju Bersama',
        recipient_name: 'Budi Santoso',
        tax_id: '01.123.456.7-789.000',
        street_address: 'Jl. Sudirman No. 123',
        city: 'Jakarta',
        state: 'DKI Jakarta',
        postal_code: '12930',
        house: 'Gedung Menara Tinggi Lt. 5',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        uuid: uuidv4(),
        name: 'CV Sukses Mandiri',
        recipient_name: 'Dewi Lestari',
        tax_id: '02.345.678.9-012.000',
        street_address: 'Jl. Gatot Subroto No. 456',
        city: 'Bandung',
        state: 'Jawa Barat',
        postal_code: '40115',
        house: 'Ruko Permata Blok A-12',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        uuid: uuidv4(),
        name: 'PT Teknologi Prima',
        recipient_name: 'Agus Wijaya',
        tax_id: '03.456.789.0-123.000',
        street_address: 'Jl. Diponegoro No. 789',
        city: 'Surabaya',
        state: 'Jawa Timur',
        postal_code: '60241',
        house: 'Gedung Cyber Tower Lt. 3',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('Customer', customers, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Customer', null, {});
  }
};