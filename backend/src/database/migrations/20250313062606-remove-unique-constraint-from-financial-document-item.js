'use strict';

module.exports = {
  up: async (queryInterface) => {
    try {
      // Get all indexes for the table
      const [indexes] = await queryInterface.sequelize.query(
        `SHOW INDEXES FROM FinancialDocumentItem;`
      );
      
      console.log('Found indexes:', indexes.map(idx => idx.Key_name));
      
      // Function to safely drop an index
      const safelyDropIndex = async (indexName) => {
        try {
          await queryInterface.sequelize.query(
            `ALTER TABLE FinancialDocumentItem DROP INDEX \`${indexName}\`;`
          );
          console.log(`Successfully removed index: ${indexName}`);
          return true;
        } catch (error) {
          if (error.message.includes('needed in a foreign key constraint')) {
            console.log(`Cannot drop index ${indexName} due to foreign key constraint`);
            
            // Get the foreign key name
            const [foreignKeys] = await queryInterface.sequelize.query(`
              SELECT CONSTRAINT_NAME
              FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
              WHERE TABLE_NAME = 'FinancialDocumentItem'
              AND REFERENCED_TABLE_NAME IS NOT NULL
              AND CONSTRAINT_SCHEMA = DATABASE();
            `);
            
            // Drop foreign keys first
            for (const fk of foreignKeys) {
              await queryInterface.sequelize.query(
                `ALTER TABLE FinancialDocumentItem DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\`;`
              );
              console.log(`Removed foreign key constraint: ${fk.CONSTRAINT_NAME}`);
            }
            
            // Try dropping the index again
            await queryInterface.sequelize.query(
              `ALTER TABLE FinancialDocumentItem DROP INDEX \`${indexName}\`;`
            );
            console.log(`Successfully removed index: ${indexName} after removing foreign keys`);
            return true;
          } else {
            console.log(`Failed to remove index ${indexName}: ${error.message}`);
            return false;
          }
        }
      };
      
      // Remove the unique compound index first (if it exists)
      const uniqueIndex = 'financial_document_item_document_type_document_id_item_id';
      await safelyDropIndex(uniqueIndex);
      
      // Remove the document_type+document_id index
      const docTypeIdIndex = 'financial_document_item_document_type_document_id';
      await safelyDropIndex(docTypeIdIndex);
      
      // Remove the item_id index
      const itemIdIndex = 'financial_document_item_item_id';
      await safelyDropIndex(itemIdIndex);
      
      console.log('Successfully removed all targeted indexes');
      
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  down: async (queryInterface) => {
    // Recreate indexes if needed
    await queryInterface.addIndex('FinancialDocumentItem', ['document_type', 'document_id']);
    await queryInterface.addIndex('FinancialDocumentItem', ['item_id']);
    
    // Recreate the compound unique index
    await queryInterface.addIndex('FinancialDocumentItem', 
      ['document_type', 'document_id', 'item_id'], 
      { unique: true }
    );
    
    // Note: This doesn't recreate any foreign keys that were dropped
  }
};