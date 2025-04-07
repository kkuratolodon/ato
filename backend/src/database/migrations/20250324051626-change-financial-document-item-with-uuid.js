'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // 1. First remove AUTO_INCREMENT attribute while keeping the primary key
      await queryInterface.sequelize.query(
        `ALTER TABLE FinancialDocumentItem MODIFY id INT NOT NULL`
      );
      
      // 2. Now drop the primary key constraint
      await queryInterface.sequelize.query(
        `ALTER TABLE FinancialDocumentItem DROP PRIMARY KEY`
      );

      // 3. Modify the ID column to use UUID
      await queryInterface.changeColumn('FinancialDocumentItem', 'id', {
        type: Sequelize.CHAR(36),
        allowNull: false
      });

      // 4. Convert existing IDs to UUIDs
      await queryInterface.sequelize.query(
        `UPDATE FinancialDocumentItem SET id = UUID() WHERE 1=1`
      );

      // 5. Add primary key constraint back
      await queryInterface.sequelize.query(
        `ALTER TABLE FinancialDocumentItem ADD PRIMARY KEY (id)`
      );

      // 6. Set UUID as default for future records
      await queryInterface.changeColumn('FinancialDocumentItem', 'id', {
        type: Sequelize.CHAR(36),
        defaultValue: Sequelize.literal('(UUID())'),
        allowNull: false
      });
      
      console.log('FinancialDocumentItem table updated successfully');
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // 1. Create a temporary column for new integer IDs
      await queryInterface.addColumn('FinancialDocumentItem', 'temp_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      });
      
      // 2. Fill temporary column with sequential IDs - Fixed to use separate queries
      await queryInterface.sequelize.query(`SET @counter = 0;`);
      await queryInterface.sequelize.query(
        `UPDATE FinancialDocumentItem SET temp_id = @counter := @counter + 1`
      );
      
      // 3. Drop the primary key
      await queryInterface.sequelize.query(
        `ALTER TABLE FinancialDocumentItem DROP PRIMARY KEY`
      );
      
      // 4. Drop the old UUID id column
      await queryInterface.removeColumn('FinancialDocumentItem', 'id');
      
      // 5. Rename temp_id to id
      await queryInterface.renameColumn('FinancialDocumentItem', 'temp_id', 'id');
      
      // 6. Add primary key with auto-increment
      await queryInterface.sequelize.query(
        `ALTER TABLE FinancialDocumentItem MODIFY id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`
      );
      
      console.log('FinancialDocumentItem table reverted successfully');
    } catch (error) {
      console.error('Error in down migration:', error);
      throw error;
    }
  }
};