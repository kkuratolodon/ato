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

    async delete(id) {
        const purchaseOrder = await PurchaseOrder.findByPk(id);
        if (purchaseOrder) {
          await purchaseOrder.destroy();
        }
      }
    
    async hardDelete(id) {
        await PurchaseOrder.destroy({ 
            where: { id },
            force: true  
        });
    }
    
    async restore(id) {
        const purchaseOrder = await PurchaseOrder.findByPk(id, { paranoid: false });
        if (purchaseOrder && purchaseOrder.deleted_at) {
            await purchaseOrder.restore();
            return true;
        }
        return false;
    } 
}

module.exports = PurchaseOrderRepository;