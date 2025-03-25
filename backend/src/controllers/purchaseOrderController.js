const FinancialDocumentController = require('./financialDocumentController');
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

class PurchaseOrderController extends FinancialDocumentController {
  constructor(puchaseOrderService) {
    super(puchaseOrderService, "Purchase Order");
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

// exports.uploadPurchaseOrder = async(req,res) => {
//     return purchaseOrderController.uploadFile(req,res);
// }