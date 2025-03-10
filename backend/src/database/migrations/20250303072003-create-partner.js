"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("partner", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      uuid: {
        type: Sequelize.STRING(45),
        unique: true,
      },
      email: {
        type: Sequelize.STRING(50),
        allowNull: false,
        // Validasi sebaiknya dilakukan di level model, karena migration hanya membuat schema tabel.
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      company_name: {
        type: Sequelize.STRING(255),
      },
      code: {
        type: Sequelize.STRING(45),
      },
      role: {
        type: Sequelize.STRING(100),
      },
      phone_number: {
        type: Sequelize.STRING(20),
      },
      menu: {
        type: Sequelize.JSON,
      },
      auth: {
        type: Sequelize.JSON,
      },
      config: {
        type: Sequelize.JSON,
      },
      data_expiry_day: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 7,
      },
      client_id: {
        type: Sequelize.STRING(45),
      },
      client_secret: {
        type: Sequelize.STRING(45),
      },
      two_factor_authentication: {
        type: Sequelize.ENUM("none", "active", "inactive"),
        allowNull: false,
        defaultValue: "none",
      },
      secret: {
        type: Sequelize.STRING(20),
      },
      status: {
        type: Sequelize.ENUM("pending", "approved"),
        allowNull: false,
        defaultValue: "pending",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
      },
      deleted_at: {
        type: Sequelize.DATE,
      },
      last_login_at: {
        type: Sequelize.DATE,
      },
      password_expired_at: {
        type: Sequelize.DATE,
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("partner");
  }
};
