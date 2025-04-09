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

/**
 * Analyzes a purchase order document using Azure Form Recognizer and optionally saves to database
 */
exports.analyzePurchaseOrder = async (req, res) => {
  const { documentUrl } = req.body;
  const partnerId = req.user?.uuid; 
  
  if (!documentUrl) {
    return res.status(400).json({ message: "documentUrl is required" });
  }
  
  if (!partnerId) {
    return res.status(401).json({ message: "Unauthorized. User information not available." });
  }

  try {
    // Analyze document, map data, and save to database
    const result = await PurchaseOrderService.analyzePurchaseOrder(documentUrl, partnerId);
    
    if (!result?.savedPurchaseOrder) {
      return res.status(500).json({ message: "Failed to analyze purchase order: no saved purchase order returned" });
    }
    
    return res.status(200).json({
      message: "Purchase order analyzed and saved to database",
      rawData: result.rawData,
      purchaseOrderData: result.purchaseOrderData,
      savedPurchaseOrder: result.savedPurchaseOrder
    });
  } catch (error) {
    if (error.message.includes("Invalid date format") || error.message === "Purchase order contains invalid date format") {
      return res.status(400).json({ message: error.message });
    } else if (error.message === "Failed to process the document") {
      return res.status(400).json({ message: error.message });
    } else {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }
};