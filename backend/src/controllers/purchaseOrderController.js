const PurchaseOrderService = require("../services/purchaseOrderService");
const FinancialDocumentController = require('./financialDocumentController');

const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
});

class PurchaseOrderController extends FinancialDocumentController {
  constructor() {
    super(PurchaseOrderService, "Purchase Order");
  }
}

const purchaseOrderController = new PurchaseOrderController();

exports.uploadPurchaseOrder = async(req,res) => {
    return purchaseOrderController.uploadFile(req,res);
}