const purchaseOrderService = require("../services/purchaseOrder/purchaseOrderService");
const FinancialDocumentController = require('./financialDocumentController');
const Sentry = require("../instrument");
const { ValidationError, AuthError, ForbiddenError } = require('../utils/errors');

class PurchaseOrderController extends FinancialDocumentController {
  constructor(purchaseOrderService) {
    // Enhanced validation for the purchaseOrderService parameter
    if (!purchaseOrderService || 
        !purchaseOrderService.uploadPurchaseOrder || 
        typeof purchaseOrderService.uploadPurchaseOrder !== 'function') {
      throw new Error('Invalid purchase order service provided');
    }
    
    super(purchaseOrderService, "Purchase Order");
    
    // Bind methods to ensure correct context
    this.uploadPurchaseOrder = this.uploadPurchaseOrder.bind(this);
    this.getPurchaseOrderById = this.getPurchaseOrderById.bind(this);
    this.getPurchaseOrderStatus = this.getPurchaseOrderStatus.bind(this);
    this.validateGetRequest = this.validateGetRequest.bind(this);
    this.purchaseOrderService = purchaseOrderService;
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

  /**
   * @description Retrieves a purchase order by ID with authorization check.
   *
   * @throws {400} Invalid purchase order ID (null)
   * @throws {401} Unauthorized if req.user is missing
   * @throws {403} Forbidden if purchase order does not belong to the authenticated user
   * @throws {404} Not Found if purchase order is not found
   * @throws {500} Internal Server Error 
   */
  async getPurchaseOrderById(req, res) {
    try {
      const { id } = req.params;
      await this.validateGetRequest(req, id);
      const purchaseOrderDetail = await this.purchaseOrderService.getPurchaseOrderById(id);
      
      if (!purchaseOrderDetail) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      
      return res.status(200).json(purchaseOrderDetail);
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  /**
   * @description Retrieves only the status of a purchase order by ID
   * 
   * @throws {400} Invalid purchase order ID (null)
   * @throws {401} Unauthorized if req.user is missing
   * @throws {403} Forbidden if purchase order does not belong to the authenticated user
   * @throws {404} Not Found if purchase order is not found
   * @throws {500} Internal Server Error
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} JSON with purchase order ID and status
   */
  async getPurchaseOrderStatus(req, res) {
    try {
      const { id } = req.params;
      await this.validateGetRequest(req, id);
      
      const statusResult = await this.purchaseOrderService.getPurchaseOrderStatus(id);
      return res.status(200).json(statusResult);
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async validateGetRequest(req, id) {
    if (!req.user) {
      throw new AuthError("Unauthorized");
    }
    if (!id) {
      throw new ValidationError("Purchase order ID is required");
    }
    
    const purchaseOrderPartnerId = await this.purchaseOrderService.getPartnerId(id);
    if (purchaseOrderPartnerId !== req.user.uuid) {
      throw new ForbiddenError("Forbidden: You do not have access to this purchase order");
    }
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
