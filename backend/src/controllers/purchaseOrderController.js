const PurchaseOrderService = require("../services/purchaseOrder/purchaseOrderService");
const FinancialDocumentController = require('./financialDocumentController');

const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB size limit
  }
});

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        message: 'File size exceeds the 20MB limit'
      });
    }
    return res.status(400).json({ 
      message: `Upload error: ${err.message}`
    });
  }
  next(err);
};

exports.uploadMiddleware = [upload.single('file'), handleMulterError];

class PurchaseOrderController extends FinancialDocumentController {
  constructor() {
    super(PurchaseOrderService, "Purchase Order");
  }
}

const purchaseOrderController = new PurchaseOrderController();

exports.uploadPurchaseOrder = async(req,res) => {
    return purchaseOrderController.uploadFile(req,res);
}