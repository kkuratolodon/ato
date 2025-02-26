'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Invoice extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate() {
      // define association here
    }
  }
  Invoice.init({
    invoice_date: DataTypes.DATE,
    due_date: DataTypes.DATE,
    purchase_order_id: DataTypes.INTEGER,
    total_amount: DataTypes.DECIMAL,
    subtotal_amount: DataTypes.DECIMAL,
    discount_amount: DataTypes.DECIMAL,
    payment_terms: DataTypes.STRING,
    file_url: DataTypes.STRING,
    status: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Invoice',
  });
  return Invoice;
};