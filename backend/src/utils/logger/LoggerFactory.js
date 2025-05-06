const InvoiceLogger = require('./InvoiceLogger');
const PurchaseOrderLogger = require('./PurchaseOrderLogger');

/**
 * LoggerFactory - Factory class for creating loggers
 * This follows the Factory pattern to create appropriate logger instances
 */
class LoggerFactory {
  /**
   * Create an appropriate logger instance based on document type
   * @param {string} documentType - Type of document ('invoice' or 'purchase-order')
   * @returns {BaseLogger} An instance of the appropriate logger
   */
  static createLogger(documentType) {
    switch (documentType.toLowerCase()) {
      case 'invoice':
        return InvoiceLogger.getInstance();
      case 'purchase-order':
        return PurchaseOrderLogger.getInstance();
      default:
        throw new Error(`Unknown document type: ${documentType}`);
    }
  }
}

module.exports = LoggerFactory;