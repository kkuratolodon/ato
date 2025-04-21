const purchaseOrderService = require("../services/purchaseOrder/purchaseOrderService");
const FinancialDocumentController = require('./financialDocumentController');
const Sentry = require("../instrument");
const { ValidationError, AuthError, ForbiddenError } = require('../utils/errors');

class PurchaseOrderController extends FinancialDocumentController {
  constructor(purchaseOrderService) {
    super(purchaseOrderService, "Purchase Order");
    
    // Bind methods to ensure correct context
    this.uploadPurchaseOrder = this.uploadPurchaseOrder.bind(this);
  }

  /**
   * Handles the upload and validation of purchase order PDF files with an automatic 3-second timeout.
   *
   * This function performs multiple validation steps on the uploaded file:
   * 1. Authentication: Verifies client credentials before processing.
   * 2. Timeout Protection: Automatically terminates the request if it exceeds 3 seconds.
   * 3. File Type Validation: Ensures the uploaded file is a valid PDF.
   * 4. Encryption Check: Rejects encrypted PDFs.
   * 5. Integrity Check: Verifies the PDF is not corrupted.
   * 6. Size Validation: Ensures the file does not exceed the allowed size limit.
   * 7. Upload Process: Uploads the validated purchase order file.
   *
   * @param {Object} req - Express request object containing the uploaded file and request data.
   * @param {Object} req.file - Uploaded file information from Multer middleware.
   * @param {Buffer} req.file.buffer - File content in buffer format.
   * @param {string} req.file.originalname - Original filename including extension.
   * @param {string} req.file.mimetype - MIME type of the file.
   * @param {Object} req.user - Request containing authentication credentials.
   * @param {string} req.user.uuid - Unique identifier for the partner/user uploading the file.
   * @param {Object} res - Express response object.
   * @returns {Promise<Object>} JSON response with appropriate status code and message.
   */
  async uploadPurchaseOrder(req, res) {
    return await this.uploadFile(req, res);
  }

  async processUpload(req) {
    const { buffer, originalname, mimetype } = req.file;
    const partnerId = req.user.uuid;

    Sentry.addBreadcrumb({
      category: 'upload',
      message: 'Starting purchase order upload process',
      data: {
        filename: originalname,
        partnerId,
        fileSize: buffer.length
      }
    });

    try {
      const result = await this.service.uploadPurchaseOrder({
        buffer,
        originalname,
        mimetype,
        partnerId
      });

      Sentry.captureMessage('Purchase order upload successful', {
        level: 'info',
        extra: { 
          purchaseOrderId: result.id,
          partnerId 
        }
      });

      return result;
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          filename: originalname,
          partnerId,
          fileSize: buffer.length
        }
      });
      throw error;
    }
  }
}

const controller = new PurchaseOrderController(purchaseOrderService);
module.exports = {
  PurchaseOrderController,  // Export the class for testing
  controller               // Export instance for routes
};
