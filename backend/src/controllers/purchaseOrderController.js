const purchaseOrderService = require("../services/purchaseOrder/purchaseOrderService");
const FinancialDocumentController = require('./financialDocumentController');
const Sentry = require("../instrument");
const { ValidationError, AuthError, ForbiddenError, NotFoundError } = require('../utils/errors');
const { from, of, throwError } = require('rxjs');
const { catchError, mergeMap, tap } = require('rxjs/operators');
const validateDeletionService = require('../services/validateDeletion');
const s3Service = require('../services/s3Service');

class PurchaseOrderController extends FinancialDocumentController {
  constructor(dependencies = {}) {
    if (!dependencies.purchaseOrderService || 
        !dependencies.purchaseOrderService.uploadPurchaseOrder || 
        typeof dependencies.purchaseOrderService.uploadPurchaseOrder !== 'function') {
      throw new Error('Invalid purchase order service provided');
    }
    
    super(dependencies.purchaseOrderService, "Purchase Order");

    this.validateDeletionService = dependencies.validateDeletionService;
    this.s3Service = dependencies.s3Service;
    this.purchaseOrderService = dependencies.purchaseOrderService;
    
    this.uploadPurchaseOrder = this.uploadPurchaseOrder.bind(this);
    this.getPurchaseOrderById = this.getPurchaseOrderById.bind(this);
    this.getPurchaseOrderStatus = this.getPurchaseOrderStatus.bind(this);
    this.deletePurchaseOrderById = this.deletePurchaseOrderById.bind(this);
    this.validateGetRequest = this.validateGetRequest.bind(this);
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
        throw new NotFoundError("Purchase order not found");
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

  /**
   * Deletes a purchase order by its ID.
   * Handles validation, S3 file deletion (if applicable), and database record deletion.
   *
   * @param {Object} req - The request object containing parameters and user info.
   * @param {Object} res - The response object used to send status and messages.
   */
  deletePurchaseOrderById(req, res) {
    const { id } = req.params;
    const partnerId = req.user?.uuid; 

    if (!partnerId) {
      return this.handleError(res, new AuthError("Unauthorized"));
    }
    if (!id) {
      return this.handleError(res, new ValidationError("Purchase order ID is required"));
    }

    Sentry.addBreadcrumb({
      category: "purchaseOrderDeletion",
      message: `Partner ${partnerId} attempting to delete purchase order ${id}`,
      level: "info"
    });

    from(this.validateDeletionService.validatePurchaseOrderDeletion(partnerId, id))
      .pipe(
        mergeMap(purchaseOrder => {
          if (purchaseOrder.file_url) {
            const fileKey = purchaseOrder.file_url.split('/').pop();
            return from(this.s3Service.deleteFile(fileKey)).pipe(
              mergeMap(deleteResult => {
                if (!deleteResult.success) {
                  const s3Error = new Error(`Failed to delete file from S3 for PO ${id}`);
                  s3Error.status = 500; 
                  Sentry.captureException(s3Error, { extra: { s3Response: deleteResult.error } });
                  return throwError(() => s3Error);
                }
                console.log(`File ${fileKey} deleted from S3 for PO ${id}`);
                return of(purchaseOrder); 
              })
            );
          }
          return of(purchaseOrder);
        }),
        mergeMap(() => this.purchaseOrderService.deletePurchaseOrderById(id)), 
        tap(() => { // Removed unused '_' parameter
          Sentry.captureMessage(`Purchase Order ${id} successfully deleted by ${partnerId}`, { level: 'info' });
          console.log(`Purchase Order ${id} successfully deleted.`);
        }),
        catchError(error => {
          console.error(`Error deleting purchase order ${id}:`, error);
          Sentry.captureException(error, { extra: { purchaseOrderId: id, partnerId } });

          if (error instanceof NotFoundError) {
            return of({ status: 404, message: error.message });
          }
          if (error instanceof ForbiddenError) {
            return of({ status: 403, message: error.message });
          }
          if (error.message?.includes("cannot be deleted unless it is")) { 
            return of({ status: 409, message: error.message });
          }
          if (error.message?.includes("Failed to delete file from S3")) {
             return of({ status: error.status || 500, message: error.message });
          }
          if (error.message?.includes(`Failed to delete purchase order with ID: ${id}`)) {
             return of({ status: 404, message: error.message });
          }
          if (error.message?.includes("Failed to delete purchase order")) {
             return of({ status: 500, message: error.message }); 
          }

          return of({ status: 500, message: "Internal server error during deletion" });
        })
      )
      .subscribe({
        next: (result) => {
          if (result && result.status) {
            return res.status(result.status).json({ message: result.message });
          }
          return res.status(200).json(result); 
        },
        error: (err) => {
          console.error("Unhandled error in deletePurchaseOrderById subscription:", err);
          Sentry.captureException(err, { extra: { purchaseOrderId: id, partnerId, context: 'Subscription Error' } });
          return res.status(500).json({ message: "An unexpected error occurred" });
        }
      });
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

const controller = new PurchaseOrderController({
  purchaseOrderService: purchaseOrderService,
  validateDeletionService: validateDeletionService,
  s3Service: s3Service
});

module.exports = {
  PurchaseOrderController,
  controller
};
