const { Vendor } = require('../models');

class VendorRepository {
  async findById(id) {
    const vendor = await Vendor.findByPk(id);
    return vendor ? vendor.get({ plain: true }) : null;
  }

  async findByAttributes(attributes) {
    const vendor = await Vendor.findOne({ where: attributes });
    return vendor ? vendor.get({ plain: true }) : null;
  }

  async create(vendorData) {
    const vendor = await Vendor.create(vendorData);
    return vendor.get({ plain: true });
  }
}

module.exports = VendorRepository;