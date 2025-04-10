const InvoiceRepository = require("../repositories/invoiceRepository");
const Sentry = require("../instrument");

/**
 * Class for handling invoice deletion validation logic
 */
class ValidateDeletion {
  constructor() {
    this.invoiceRepository = new InvoiceRepository();
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
      const err = new Error("Invalid invoice ID");
      Sentry.captureException(err);
      throw err;
    }
    
    const invoice = await this.invoiceRepository.findById(invoiceId);
    
    if (!invoice) {
      const err = new Error("Invoice not found");
      Sentry.captureException(err);
      throw err;
    }
    
    if (invoice.partner_id !== partnerId) {
      const err = new Error("Unauthorized: You do not own this invoice");
      Sentry.captureException(err);
      throw err;
    }
    
    if (invoice.status !== "Analyzed") {
      const err = new Error("Invoice cannot be deleted unless it is Analyzed");
      Sentry.captureException(err);
      throw err;
    }    

    return invoice;
  }
}

module.exports = new ValidateDeletion();