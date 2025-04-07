'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper function to remove column if exists
    const safeRemoveColumn = async (table, column) => {
      try {
        await queryInterface.removeColumn(table, column);
        console.log(`Successfully removed column ${column} from table ${table}`);
      } catch (error) {
        console.log(`Column ${column} doesn't exist in table ${table} or other error: ${error.message}`);
      }
    };

    // 1. For Customer table: add new address column
    try {
      await queryInterface.addColumn('Customer', 'address', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      
      // 2. Copy data from street_address to address if exists
      try {
        await queryInterface.sequelize.query(`
          UPDATE \`Customer\` 
          SET address = street_address 
          WHERE street_address IS NOT NULL
        `);
      } catch (error) {
        console.log(`Error while copying data: ${error.message}`);
      }
    } catch (error) {
      console.log(`Address column might already exist in Customer: ${error.message}`);
    }

    // 3. Remove old columns from Customer
    await Promise.all([
      safeRemoveColumn('Customer', 'street_address'),
      safeRemoveColumn('Customer', 'city'),
      safeRemoveColumn('Customer', 'state'),
      safeRemoveColumn('Customer', 'postal_code'),
      safeRemoveColumn('Customer', 'house')
    ]);

    // 1. For Vendor table: add new address column
    try {
      await queryInterface.addColumn('Vendor', 'address', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      
      // 2. Copy data from street_address to address if exists
      try {
        await queryInterface.sequelize.query(`
          UPDATE \`Vendor\` 
          SET address = street_address 
          WHERE street_address IS NOT NULL
        `);
      } catch (error) {
        console.log(`Error while copying data: ${error.message}`);
      }
    } catch (error) {
      console.log(`Address column might already exist in Vendor: ${error.message}`);
    }

    // 3. Remove old columns from Vendor
    await Promise.all([
      safeRemoveColumn('Vendor', 'street_address'),
      safeRemoveColumn('Vendor', 'city'),
      safeRemoveColumn('Vendor', 'state'),
      safeRemoveColumn('Vendor', 'postal_code'),
      safeRemoveColumn('Vendor', 'house')
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    // Helper function to add column if not exists
    const safeAddColumn = async (table, column, options) => {
      try {
        await queryInterface.addColumn(table, column, options);
        console.log(`Successfully added column ${column} to table ${table}`);
      } catch (error) {
        console.log(`Column ${column} might already exist in ${table} or other error: ${error.message}`);
      }
    };

    // 1. For Customer table: add back street_address column
    await safeAddColumn('Customer', 'street_address', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // 2. Copy data from address to street_address if address exists
    try {
      await queryInterface.sequelize.query(`
        UPDATE \`Customer\` 
        SET street_address = address 
        WHERE address IS NOT NULL
      `);
    } catch (error) {
      console.log(`Error while copying data: ${error.message}`);
    }

    // 3. Add back old columns for Customer
    await Promise.all([
      safeAddColumn('Customer', 'city', {
        type: Sequelize.STRING(100),
        allowNull: true
      }),
      safeAddColumn('Customer', 'state', {
        type: Sequelize.STRING(100),
        allowNull: true
      }),
      safeAddColumn('Customer', 'postal_code', {
        type: Sequelize.STRING(20),
        allowNull: true
      }),
      safeAddColumn('Customer', 'house', {
        type: Sequelize.STRING(100),
        allowNull: true
      })
    ]);

    // 4. Remove address column from Customer if it still exists
    try {
      await queryInterface.removeColumn('Customer', 'address');
    } catch (error) {
      console.log(`Address column doesn't exist in Customer or other error: ${error.message}`);
    }

    // Do the same for Vendor
    await safeAddColumn('Vendor', 'street_address', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    try {
      await queryInterface.sequelize.query(`
        UPDATE \`Vendor\` 
        SET street_address = address 
        WHERE address IS NOT NULL
      `);
    } catch (error) {
      console.log(`Error while copying data: ${error.message}`);
    }

    await Promise.all([
      safeAddColumn('Vendor', 'city', {
        type: Sequelize.STRING(100),
        allowNull: true
      }),
      safeAddColumn('Vendor', 'state', {
        type: Sequelize.STRING(100), 
        allowNull: true
      }),
      safeAddColumn('Vendor', 'postal_code', {
        type: Sequelize.STRING(20),
        allowNull: true
      }),
      safeAddColumn('Vendor', 'house', {
        type: Sequelize.STRING(100),
        allowNull: true
      })
    ]);

    try {
      await queryInterface.removeColumn('Vendor', 'address');
    } catch (error) {
      console.log(`Address column doesn't exist in Vendor or other error: ${error.message}`);
    }
  }
};