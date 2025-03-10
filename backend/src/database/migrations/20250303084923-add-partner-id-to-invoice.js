'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Invoice', 'partner_id', {
      type: Sequelize.STRING(45),
      allowNull: false,
      // Reference the partner table's uuid column
      references: {
        model: 'partner', // table name of Partner model (as defined in partner.js)
        key: 'uuid',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Invoice', 'partner_id');
  }
};
