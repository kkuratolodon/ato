const DocumentStatus = require("../models/enums/DocumentStatus");
const InvoiceRepository = require("../repositories/invoiceRepository");
const PurchaseOrderRepository = require("../repositories/purchaseOrderRepository");
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Class for handling invoice deletion validation logic
 */
class ValidateDeletion {
  constructor() {
    this.invoiceRepository = new InvoiceRepository();
    this.purchaseOrderRepository = new PurchaseOrderRepository();
  }

  /**
   * Validates if an invoice can be deleted by a partner.
   * 
   * @param {string} partnerId - The ID of the partner requesting deletion.
   * @param {number} invoiceId - The ID of the invoice to be deleted.
   * @returns {Promise<Object>} The invoice object if deletion is allowed.
   * @throws {Error} If the invoice is not found, unauthorized, or cannot be deleted.
   */
  async validateInvoiceDeletion(partnerId, invoiceId) {
    if (!invoiceId) {
      throw new ValidationError("Invalid invoice ID");
    }

    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }

    if (invoice.partner_id !== partnerId) {
      throw new ForbiddenError("Unauthorized: You do not own this invoice");
    }

    if (invoice.status !== DocumentStatus.ANALYZED) {
      throw new Error("Invoice cannot be deleted unless it is Analyzed");
    }

    return invoice;
  }

  /**
   * Validates if a purchase order can be deleted by a partner.
   * 
   * @param {string} partnerId - The ID of the partner requesting deletion.
   * @param {string} purchaseOrderId - The ID of the purchase order to be deleted.
   * @returns {Promise<Object>} The purchase order object if deletion is allowed.
   * @throws {Error} If the purchase order is not found, unauthorized, or cannot be deleted.
   */
  async validatePurchaseOrderDeletion(partnerId, purchaseOrderId) {
    if (!purchaseOrderId) {
      throw new ValidationError("Invalid purchase order ID");
    }

    const purchaseOrder = await this.purchaseOrderRepository.findById(purchaseOrderId);

    if (!purchaseOrder) {
      throw new NotFoundError("Purchase order not found");
    }

    if (purchaseOrder.partner_id !== partnerId) {
      throw new ForbiddenError("Unauthorized: You do not own this purchase order");
    }

    if (purchaseOrder.status !== DocumentStatus.ANALYZED) {
      throw new Error("Purchase order cannot be deleted unless it is Analyzed");
    }

    return purchaseOrder;
  }
}

module.exports = new ValidateDeletion();