'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const customers = [
      {
        uuid: uuidv4(),
        name: 'PT Maju Bersama',
        street_address: 'Jl. Sudirman No. 123',
        city: 'Jakarta',
        state: 'DKI Jakarta',
        postal_code: '12930',
        house: 'Gedung Menara Tinggi Lt. 5',
        email: 'contact@majubersama.co.id',
        phone: '021-5551234',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        uuid: uuidv4(),
        name: 'CV Sukses Mandiri',
        street_address: 'Jl. Gatot Subroto No. 456',
        city: 'Bandung',
        state: 'Jawa Barat',
        postal_code: '40115',
        house: 'Ruko Permata Blok A-12',
        email: 'info@suksesmandiri.com',
        phone: '022-6673210',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        uuid: uuidv4(),
        name: 'PT Teknologi Prima',
        street_address: 'Jl. Diponegoro No. 789',
        city: 'Surabaya',
        state: 'Jawa Timur',
        postal_code: '60241',
        house: 'Gedung Cyber Tower Lt. 3',
        email: 'support@teknologiprima.id',
        phone: '031-9982345',
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