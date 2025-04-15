const InvoiceService = require('../services/invoice/invoiceService');
const FinancialDocumentController = require('./financialDocumentController');
const validateDeletion = require('../services/validateDeletion');
const s3Service = require('../services/s3Service');
const Sentry = require("../instrument");
const { ValidationError, AuthError, ForbiddenError } = require('../utils/errors');


class InvoiceController extends FinancialDocumentController {
  constructor(invoiceService) {
    super(invoiceService, "Invoice");
  }

  /**
 * Handles the upload and validation of invoice PDF files with an automatic 3-second timeout.
 *
 * This function performs multiple validation steps on the uploaded file:
 * 1. Authentication: Verifies client credentials before processing.
 * 2. Timeout Protection: Automatically terminates the request if it exceeds 3 seconds.
 * 3. File Type Validation: Ensures the uploaded file is a valid PDF.
 * 4. Encryption Check: Rejects encrypted PDFs.
 * 5. Integrity Check: Verifies the PDF is not corrupted.
 * 6. Size Validation: Ensures the file does 2not exceed the allowed size limit.
 * 7. Upload Process: Uploads the validated invoice file.
 *
 * The function uses a Promise.race mechanism to implement the timeout, ensuring that
 * the server responds in a timely manner even when processing large files or experiencing
 * unexpected delays in the validation or upload process.
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
 *
 * @throws {Error} Returns specific error messages for each validation failure.
 * Returns a 504 Gateway Timeout response if processing exceeds 3 seconds.
 * Logs internal server errors to the console but provides a generic response to the client.
 */
  async uploadInvoice(req, res) {
    return this.uploadFile(req, res)
  }

  async processUpload(req) {
    const { buffer, originalname, mimetype } = req.file;
    const partnerId = req.user.uuid;

    return await this.service.uploadInvoice({
      buffer,
      originalname,
      mimetype,
      partnerId
    })
  }

  /**
   * @description Retrieves an invoice by ID with authorization check.
   *
   * @throws {400} Invalid invoice ID (non-numeric, null, or negative)
   * @throws {401} Unauthorized if req.user is missing
   * @throws {403} Forbidden if invoice does not belong to the authenticated user
   * @throws {404} Not Found if invoice is not found
   * @throws {500} Internal Server Error 
   */
  async getInvoiceById(req, res) {
    try {
      const { id } = req.params;
      await this.validateGetRequest(req, id);
      const invoiceDetail = await this.service.getInvoiceById(id);
      if (!invoiceDetail) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      return res.status(200).json(invoiceDetail);
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async validateGetRequest(req, id) {
    if (!req.user) {
      throw new AuthError("Unauthorized");
    }
    if (!id) {
      throw new ValidationError("Invoice ID is required");
    }
    if (isNaN(id) || parseInt(id) <= 0) {
      throw new ValidationError("Invalid invoice ID");
    }
    const invoicePartnerId = await this.service.getPartnerId(id);
    if (invoicePartnerId !== req.user.uuid) {
      throw new ForbiddenError("Forbidden: You do not have access to this invoice");
    }
  }

  /**
 * Deletes an invoice by its ID.
 *
 * @param {Object} req - The request object containing parameters and user info.
 * @param {Object} res - The response object used to send status and messages.
 * @returns {Promise<Response>} The response indicating success or failure.
 */
  async deleteInvoiceById(req, res) {
    try {
      const { id } = req.params;

      // TODO: check sentry  config again for all method 
      Sentry.addBreadcrumb({
        category: "invoiceDeletion",
        message: `Partner ${req.user.uuid} attempting to delete invoice ${id}`,
        level: "info"
      });

      let invoice;
      invoice = await validateDeletion.validateInvoiceDeletion(req.user.uuid, id);

      if (invoice.file_url) {
        const fileKey = invoice.file_url.split('/').pop();
        const deleteResult = await s3Service.deleteFile(fileKey);
        if (!deleteResult.success) {
          // TODO: refactor this too 
          const err = new Error("Failed to delete file from S3");
          Sentry.captureException(err);
          return res.status(500).json({ message: err.message, error: deleteResult.error });
        }
      }

      await InvoiceService.deleteInvoiceById(id);

      Sentry.captureMessage(`Invoice ${id} successfully deleted by ${req.user.uuid}`);
      return res.status(200).json({ message: "Invoice successfully deleted" });

    } catch (error) {
      // TODO: refactor this 
      Sentry.captureException(error);

      if (error.message === "Invoice not found") {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === "Unauthorized: You do not own this invoice") {
        return res.status(403).json({ message: error.message });
      }
      if (error.message === "Invoice cannot be deleted unless it is Analyzed") {
        return res.status(409).json({ message: error.message });
      }
      
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}

// TODO: check again this part, might want to export class instead
const controller = new InvoiceController(InvoiceService);
module.exports = {
  InvoiceController,  // Export the class for testing
  controller         // Export instance for routes
};