const { PurchaseOrder } = require('../models');

class PurchaseOrderRepository {
    async findById(id) {
        return await PurchaseOrder.findByPk(id);
    }

    async createInitial(purchaseOrderData) {
        return await PurchaseOrder.create(purchaseOrderData);
    }

    async update(id, data) {
        await PurchaseOrder.update(data, {
            where: { id }
        });
        return await this.findById(id);
    }

    async updateStatus(id, status) {
        return await PurchaseOrder.update({ status }, {
            where: { id }
        });
    }
}

module.exports = PurchaseOrderRepository;