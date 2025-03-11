// Buat file migration baru
// npx sequelize-cli migration:generate --name modify-purchase-order-id-type

// filepath: c:\Users\mif05\OneDrive\Documents\Kuliah\Semester_6\PPL\fin-invoice-ocr-team6\backend\src\database\migrations\YYYYMMDDHHMMSS-modify-purchase-order-id-type.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Invoice', 'purchase_order_id', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Invoice', 'purchase_order_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  }
};