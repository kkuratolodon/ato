'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Item', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      sku: {
        type: Sequelize.STRING,
        allowNull: true
      },
      quantity: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      unit: {
        type: Sequelize.STRING,
        allowNull: true
      },
      unit_price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('Item');
  }
};