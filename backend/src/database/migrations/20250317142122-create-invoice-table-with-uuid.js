'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // 1. Hapus tabel Invoice jika sudah ada untuk clean slate
      try {
        await queryInterface.dropTable('Invoice');
        console.log('Existing Invoice table dropped');
      } catch (dropError) {
        console.log('No existing Invoice table to drop');
      }

      // 2. Buat tabel baru dengan tipe data yang tepat
      // Customer uuid adalah char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
      await queryInterface.createTable('Invoice', {
        id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          // Untuk MySQL, gunakan fungsi UUID() langsung sebagai default
          defaultValue: Sequelize.literal('(UUID())'),
          allowNull: false
        },
        invoice_number: {
          type: Sequelize.STRING,
          allowNull: true
        },
        invoice_date: {
          type: Sequelize.DATE,
          allowNull: true
        },
        due_date: {
          type: Sequelize.DATE,
          allowNull: true
        },
        purchase_order_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        original_filename: {
          type: Sequelize.STRING,
          allowNull: true
        },
        file_size: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        file_url: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        currency_symbol: {
          type: Sequelize.STRING,
          allowNull: true
        },
        currency_code: {
          type: Sequelize.STRING,
          allowNull: true
        },
        total_amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true
        },
        subtotal_amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true
        },
        tax_amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true
        },
        discount_amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true
        },
        payment_terms: {
          type: Sequelize.STRING,
          allowNull: true
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Processing'
        },
        partner_id: {
          type: Sequelize.STRING(45),
          allowNull: false
        },
        customer_id: {
          // Gunakan tipe yang identik dengan Customer.uuid
          type: Sequelize.CHAR(36),
          allowNull: true
        },
        vendor_id: {
          // Gunakan tipe yang identik dengan Vendor.uuid
          type: Sequelize.CHAR(36),
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      
      console.log('Table Invoice created successfully');

      // 3. Biarkan aplikasi berjalan tanpa foreign key constraints untuk sekarang
      // Constraint bisa ditambahkan nanti dalam migrasi terpisah jika diperlukan
      
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.dropTable('Invoice');
      console.log('Invoice table dropped in down migration');
    } catch (error) {
      console.error('Error in down migration:', error);
    }
  }
};