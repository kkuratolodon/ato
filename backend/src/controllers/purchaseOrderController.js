const FinancialDocumentController = require('./financialDocumentController');
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

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

const purchaseOrderController = new PurchaseOrderController();
module.exports = {
  PurchaseOrderController, 
  purchaseOrderController, 
  uploadMiddleware: upload.single("file")
}
