const FinancialDocumentController = require('./financialDocumentController');
const Sentry = require("../instrument");
const { ValidationError, AuthError, ForbiddenError } = require('../utils/errors');

class InvoiceController extends FinancialDocumentController {
  /**
   * @param {Object} dependencies - Controller dependencies
   * @param {Object} dependencies.invoiceService - Service for invoice operations
   * @param {Object} dependencies.validateDeletionService - Service for validation deletion
   * @param {Object} dependencies.s3Service - Service for file s3 operations
   */
  constructor(dependencies = {}) {  // Add default empty object here
    if (!dependencies.invoiceService || typeof dependencies.invoiceService.uploadInvoice !== 'function') {
      throw new Error('Invalid invoice service provided');
    }

    super(dependencies.invoiceService, "Invoice");

    this.validateDeletionService = dependencies.validateDeletionService;
    this.s3Service = dependencies.s3Service;

    // Bind methods to ensure correct context
    this.uploadInvoice = this.uploadInvoice.bind(this);
    this.getInvoiceById = this.getInvoiceById.bind(this);
    this.deleteInvoiceById = this.deleteInvoiceById.bind(this);
  }

  async uploadInvoice(req, res) {
    return await this.uploadFile(req, res);
  }

  async processUpload(req) {
    const { buffer, originalname, mimetype } = req.file;
    const partnerId = req.user.uuid;

    Sentry.addBreadcrumb({
      category: 'upload',
      message: 'Starting invoice upload process',
      data: {
        filename: originalname,
        partnerId,
        fileSize: buffer.length
      }
    });

    try {
      const result = await this.service.uploadInvoice({
        buffer,
        originalname,
        mimetype,
        partnerId
      });

      Sentry.captureMessage('Invoice upload successful', {
        level: 'info',
        extra: {
          invoiceId: result.invoiceId,
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
    const invoicePartnerId = await this.service.getPartnerId(id);
    if (invoicePartnerId !== req.user.uuid) {
      throw new ForbiddenError("Forbidden: You do not have access to this invoice");
    }
  }

  async deleteInvoiceById(req, res) {
    try {
      const { id } = req.params;

      Sentry.addBreadcrumb({
        category: "invoiceDeletion",
        message: `Partner ${req.user.uuid} attempting to delete invoice ${id}`,
        level: "info"
      });

      // Use the injected service instead of direct import
      let invoice;
      invoice = await this.validateDeletionService.validateInvoiceDeletion(req.user.uuid, id);

      if (invoice.file_url) {
        const fileKey = invoice.file_url.split('/').pop();
        const deleteResult = await this.s3Service.deleteFile(fileKey);
        if (!deleteResult.success) {
          const err = new Error("Failed to delete file from S3");
          Sentry.captureException(err);
          return res.status(500).json({ message: err.message, error: deleteResult.error });
        }
      }

      // Use the service instance from the parent class
      await this.service.deleteInvoiceById(id);

      Sentry.captureMessage(`Invoice ${id} successfully deleted by ${req.user.uuid}`);
      return res.status(200).json({ message: "Invoice successfully deleted" });

    } catch (error) {
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
  }
}

// Import dependencies for factory function
const InvoiceService = require('../services/invoice/invoiceService');
const validateDeletion = require('../services/validateDeletion');
const s3Service = require('../services/s3Service');

// Create controller instance with dependencies
const controller = new InvoiceController({
  invoiceService: InvoiceService,
  validateDeletionService: validateDeletion,
  s3Service: s3Service
});

module.exports = {
  InvoiceController,  // Export the class for testing
  controller         // Export instance for routes
};