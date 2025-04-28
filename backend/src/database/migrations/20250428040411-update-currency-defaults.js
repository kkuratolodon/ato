'use strict';

module.exports = {
  up: async (queryInterface) => {
    try {
      // Helper function to safely alter column defaults - works across different database systems
      const alterColumnDefault = async (table, column) => {
        try {
          await queryInterface.sequelize.query(
            `ALTER TABLE \`${table}\` ALTER COLUMN \`${column}\` SET DEFAULT NULL`
          );
          console.log(`Successfully updated ${column} default value in ${table}`);
        } catch (error) {
          // Try a different syntax if the first one fails (for MySQL specifically)
          try {
            await queryInterface.sequelize.query(
              `ALTER TABLE \`${table}\` MODIFY \`${column}\` VARCHAR(255) DEFAULT NULL`
            );
            console.log(`Successfully updated ${column} default value in ${table} using MySQL syntax`);
          } catch (secondError) {
            console.log(`Error updating ${column} in ${table}: ${secondError.message}`);
          }
        }
      };

      // Update Invoice table columns
      await alterColumnDefault('Invoice', 'currency_symbol');
      await alterColumnDefault('Invoice', 'currency_code');
      
      // Update PurchaseOrder table columns
      await alterColumnDefault('PurchaseOrder', 'currency_symbol');
      await alterColumnDefault('PurchaseOrder', 'currency_code');
      
      console.log('Currency defaults updated successfully');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  down: async (queryInterface) => {
    try {
      // Helper function to restore original defaults
      const restoreColumnDefault = async (table, column, defaultValue) => {
        try {
          await queryInterface.sequelize.query(
            `ALTER TABLE \`${table}\` ALTER COLUMN \`${column}\` SET DEFAULT '${defaultValue}'`
          );
          console.log(`Successfully restored ${column} default value in ${table}`);
        } catch (error) {
          // Try MySQL syntax if the first one fails
          try {
            await queryInterface.sequelize.query(
              `ALTER TABLE \`${table}\` MODIFY \`${column}\` VARCHAR(255) DEFAULT '${defaultValue}'`
            );
            console.log(`Successfully restored ${column} default value in ${table} using MySQL syntax`);
          } catch (secondError) {
            console.log(`Error restoring ${column} in ${table}: ${secondError.message}`);
          }
        }
      };

      // Restore Invoice table defaults
      await restoreColumnDefault('Invoice', 'currency_symbol', '$');
      await restoreColumnDefault('Invoice', 'currency_code', 'AUD');
      
      // Restore PurchaseOrder table defaults
      await restoreColumnDefault('PurchaseOrder', 'currency_symbol', '$');
      await restoreColumnDefault('PurchaseOrder', 'currency_code', 'AUD');
      
      console.log('Currency defaults restored successfully');
    } catch (error) {
      console.error('Migration rollback error:', error);
      throw error;
    }
  }
};