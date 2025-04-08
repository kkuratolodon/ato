const { Invoice } = require('../models');

class InvoiceRepository {
  async createInitial(invoiceData) {
    return await Invoice.create(invoiceData);
  }

  async findById(id) {
    const invoice = await Invoice.findOne({ where: { id } });
    return invoice ? invoice.get({ plain: true }) : null;
  }

  async update(id, data) {
    await Invoice.update(data, { where: { id } });
  }

  async updateStatus(id, status) {
    await Invoice.update({ status }, { where: { id } });
  }

  async updateCustomerId(id, customerId) {
    await Invoice.update({ customer_id: customerId }, { where: { id } });
  }

  async updateVendorId(id, vendorId) {
    await Invoice.update({ vendor_id: vendorId }, { where: { id } });
  }

  async delete(id) {  
    await Invoice.destroy({ where: { id } });
  }

}

module.exports = InvoiceRepository;