'use strict';

module.exports = {
  up: async (queryInterface) => {
    // Rename po_date column to due_date in PurchaseOrder table
    await queryInterface.sequelize.query(
      'ALTER TABLE dev_invoicepoocr.purchaseorder RENAME COLUMN po_date TO due_date;'
    );
  },

  down: async (queryInterface) => {
    // Revert by renaming due_date back to po_date
    await queryInterface.sequelize.query(
      'ALTER TABLE dev_invoicepoocr.purchaseorder RENAME COLUMN due_date TO po_date;'
    );
  }
};