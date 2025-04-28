'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // 1. First remove AUTO_INCREMENT attribute while keeping the primary key
      await queryInterface.sequelize.query(
        `ALTER TABLE Invoice MODIFY id INT NOT NULL`
      );
      
      // 2. Now drop the primary key constraint
      await queryInterface.sequelize.query(
        `ALTER TABLE Invoice DROP PRIMARY KEY`
      );

      // 3. Modify the ID column to use UUID
      await queryInterface.changeColumn('Invoice', 'id', {
        type: Sequelize.CHAR(36),
        allowNull: false
      });

      // 4. Convert existing IDs to UUIDs
      await queryInterface.sequelize.query(
        `UPDATE Invoice SET id = UUID() WHERE 1=1`
      );

      // 5. Add primary key constraint back
      await queryInterface.sequelize.query(
        `ALTER TABLE Invoice ADD PRIMARY KEY (id)`
      );

      // 6. Set UUID as default for future records
      await queryInterface.changeColumn('Invoice', 'id', {
        type: Sequelize.CHAR(36),
        defaultValue: Sequelize.literal('(UUID())'),
        allowNull: false
      });

      // 7. Add invoice_number column
      await queryInterface.addColumn('Invoice', 'invoice_number', {
        type: Sequelize.STRING,
        allowNull: true
      });
      
      console.log('Invoice table updated successfully');
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // 1. Remove invoice_number column if it exists
      try {
        await queryInterface.removeColumn('Invoice', 'invoice_number');
      } catch (error) {
        // Skip if column doesn't exist (errno 1091)
        if (error.original && error.original.errno === 1091) {
          console.warn('Column invoice_number does not exist, skipping');
        } else {
          throw error;
        }
      }

      // 1.5. Disable FKs and truncate to remove all rows (clear UUID values)
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
      await queryInterface.sequelize.query('TRUNCATE TABLE `Invoice`;');
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

      // 2. Drop the primary key (skip on errno 1091)
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE Invoice DROP PRIMARY KEY`
        );
      } catch (error) {
        if (!(error.original && error.original.errno === 1091)) {
          throw error;
        }
        console.warn('No primary key to drop, continuing...');
      }
      
      // 3. Revert ID column to INTEGER without primary key
      await queryInterface.changeColumn('Invoice', 'id', {
        type: Sequelize.INTEGER,
        allowNull: false
      });
      
      // 4. Add primary key with auto-increment back
      await queryInterface.sequelize.query(
        `ALTER TABLE Invoice MODIFY id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`
      );
      
      console.log('Invoice table reverted successfully');
    } catch (error) {
      console.error('Error in down migration:', error);
      throw error;
    }
  }
};