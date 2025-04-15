const purchaseOrderService = require("../services/purchaseOrder/purchaseOrderService");
const FinancialDocumentController = require('./financialDocumentController');


class PurchaseOrderController extends FinancialDocumentController {
  constructor(purchaseOrderService) {
    if (!purchaseOrderService || typeof purchaseOrderService.uploadPurchaseOrder !== 'function') {  
      throw new Error('Invalid purchase order service provided');  
    }  
    super(purchaseOrderService, "Purchase Order");
  }

  async uploadPurchaseOrder(req, res) {
    return this.uploadFile(req, res);
  }

  async processUpload(req) {
    const { buffer, originalname, mimetype } = req.file;
    const partnerId = req.user.uuid;

    return await this.service.uploadPurchaseOrder({
      buffer,
      originalname,
      mimetype,
      partnerId
    })
  }
}

const purchaseOrderController = new PurchaseOrderController(purchaseOrderService);
module.exports = {
  PurchaseOrderController, 
  purchaseOrderController,   
}
