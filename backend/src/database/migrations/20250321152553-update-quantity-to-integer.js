'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check current column type
      const tableInfo = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM FinancialDocumentItem WHERE Field = 'quantity'",
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      console.log('Current quantity column type:', tableInfo[0].Type);
      
      // Only update if type is not already INTEGER
      if (tableInfo[0].Type.toLowerCase() !== 'int') {
        // First convert any existing records to integers (floor the decimal values)
        await queryInterface.sequelize.query(
          "UPDATE FinancialDocumentItem SET quantity = FLOOR(quantity) WHERE quantity IS NOT NULL",
          { type: queryInterface.sequelize.QueryTypes.UPDATE }
        );
        
        // Then change the column type
        await queryInterface.changeColumn('FinancialDocumentItem', 'quantity', {
          type: Sequelize.INTEGER,
          allowNull: true
        });
        
        console.log('Successfully converted quantity column to INTEGER');
      } else {
        console.log('quantity column is already INTEGER, no changes needed');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to DECIMAL if needed
    await queryInterface.changeColumn('FinancialDocumentItem', 'quantity', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true
    });
  }
};