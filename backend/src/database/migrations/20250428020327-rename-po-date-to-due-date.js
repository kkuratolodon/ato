'use strict';

module.exports = {
  up: async (queryInterface) => {
    // Rename po_date column to due_date in PurchaseOrder table
    await queryInterface.renameColumn(
      'PurchaseOrder',  // table name
      'po_date',       // old column name
      'due_date'       // new column name
    );
  },

  down: async (queryInterface) => {
    // Revert by renaming due_date back to po_date
    await queryInterface.renameColumn(
      'PurchaseOrder',  // table name
      'due_date',      // old column name
      'po_date'        // new column name
    );
  }
};