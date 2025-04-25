'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Helper function to add column safely (won't fail if column already exists)
      const safeAddColumn = async (table, column, options) => {
        try {
          await queryInterface.addColumn(table, column, options);
          console.log(`Successfully added column ${column} to table ${table}`);
        } catch (error) {
          console.log(`Column ${column} might already exist in ${table} or other error: ${error.message}`);
        }
      };

      // Add is_deleted column to Invoice table
      await safeAddColumn('Invoice', 'is_deleted', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      
      // Add deleted_at column to Invoice table
      await safeAddColumn('Invoice', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      });

      console.log('Soft delete columns added successfully to Invoice tables');
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down(queryInterface) {
    try {
      // Helper function to remove column safely (won't fail if column doesn't exist)
      const safeRemoveColumn = async (table, column) => {
        try {
          await queryInterface.removeColumn(table, column);
          console.log(`Successfully removed column ${column} from table ${table}`);
        } catch (error) {
          console.log(`Column ${column} doesn't exist in table ${table} or other error: ${error.message}`);
        }
      };

      // Remove columns from Invoice table
      await safeRemoveColumn('Invoice', 'is_deleted');
      await safeRemoveColumn('Invoice', 'deleted_at');
      
      console.log('Soft delete columns removed successfully from Invoice tables');
    } catch (error) {
      console.error('Error in down migration:', error);
      throw error;
    }
  }
};