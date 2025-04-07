const { Customer } = require('../models');

class CustomerRepository {
  async findById(id) {
    const customer = await Customer.findByPk(id);
    return customer ? customer.get({ plain: true }) : null;
  }

  async findByAttributes(attributes) {
    const customer = await Customer.findOne({ where: attributes });
    return customer ? customer.get({ plain: true }) : null;
  }

  async create(customerData) {
    const customer = await Customer.create(customerData);
    return customer.get({ plain: true });
  }
}

module.exports = CustomerRepository;