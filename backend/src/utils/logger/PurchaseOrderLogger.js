const BaseLogger = require('./BaseLogger');

/**
 * PurchaseOrderLogger - Specialized logger for purchase order-related events
 * Implements the Singleton pattern for a consistent logger instance
 * and extends the BaseLogger with purchase order-specific logging methods
 */
class PurchaseOrderLogger extends BaseLogger {
  /**
   * Create a new PurchaseOrderLogger instance
   * @private - Use getInstance() instead
   */
  constructor() {
    super('purchase-order-service', 'purchase-order');
  }

  /**
   * Get the singleton instance of PurchaseOrderLogger
   * @returns {PurchaseOrderLogger} The singleton instance
   */
  static getInstance() {
    if (!PurchaseOrderLogger.instance) {
      PurchaseOrderLogger.instance = new PurchaseOrderLogger();
    }
    return PurchaseOrderLogger.instance;
  }

  /**
   * Log when a purchase order status is requested
   * @param {string} purchaseOrderId - The ID of the purchase order
   * @param {string} status - The status being requested
   */
  logStatusRequest(purchaseOrderId, status) {
    const metadata = this.createMetadata({ purchaseOrderId, status }, 'STATUS_REQUEST');
    this.info('Purchase order status requested', metadata);
  }

  /**
   * Log when a purchase order status is not found
   * @param {string} purchaseOrderId - The ID of the purchase order
   */
  logStatusNotFound(purchaseOrderId) {
    const metadata = this.createMetadata({ purchaseOrderId }, 'STATUS_NOT_FOUND');
    this.warn('Purchase order status not found', metadata);
  }

  /**
   * Log when there's an error retrieving a purchase order status
   * @param {string} purchaseOrderId - The ID of the purchase order
   * @param {Error} error - The error that occurred
   */
  logStatusError(purchaseOrderId, error) {
    const metadata = this.createMetadata({
      purchaseOrderId,
      error: error?.message || 'Unknown error',
      stack: error?.stack || ''
    }, 'STATUS_ERROR');
    
    this.error('Error retrieving purchase order status', metadata);
  }

  /**
   * Log when a purchase order upload is initiated
   * @param {string} purchaseOrderId - The ID of the purchase order
   * @param {string} partnerId - The ID of the partner uploading the purchase order
   * @param {string} filename - The name of the uploaded file
   */
  logUploadStart(purchaseOrderId, partnerId, filename) {
    const metadata = this.createMetadata({
      purchaseOrderId,
      partnerId,
      filename
    }, 'UPLOAD_START');
    
    this.info('Purchase order upload initiated', metadata);
  }

  /**
   * Log when a purchase order is successfully uploaded to S3
   * @param {string} purchaseOrderId - The ID of the purchase order
   * @param {string} s3Url - The S3 URL where the purchase order is stored
   */
  logUploadSuccess(purchaseOrderId, s3Url) {
    const metadata = this.createMetadata({
      purchaseOrderId,
      s3Url
    }, 'UPLOAD_SUCCESS');
    
    this.info('Purchase order uploaded to S3', metadata);
  }

  /**
   * Log when purchase order processing starts
   * @param {string} purchaseOrderId - The ID of the purchase order
   */
  logProcessingStart(purchaseOrderId) {
    const metadata = this.createMetadata({ purchaseOrderId }, 'PROCESSING_START');
    this.info('Starting purchase order processing', metadata);
  }

  /**
   * Log when purchase order analysis is completed
   * @param {string} purchaseOrderId - The ID of the purchase order
   * @param {string} jsonUrl - The URL to the analysis JSON
   */
  logAnalysisComplete(purchaseOrderId, jsonUrl) {
    const metadata = this.createMetadata({
      purchaseOrderId,
      jsonUrl
    }, 'ANALYSIS_COMPLETE');
    
    this.info('Purchase order analysis completed', metadata);
  }

  /**
   * Log when purchase order processing is completed
   * @param {string} purchaseOrderId - The ID of the purchase order
   */
  logProcessingComplete(purchaseOrderId) {
    const metadata = this.createMetadata({ purchaseOrderId }, 'PROCESSING_COMPLETE');
    this.info('Purchase order processing completed successfully', metadata);
  }

  /**
   * Log when an error occurs during purchase order processing
   * @param {string} purchaseOrderId - The ID of the purchase order
   * @param {Error} error - The error that occurred
   * @param {string} stage - The processing stage when the error occurred
   */
  logError(purchaseOrderId, error, stage) {
    const metadata = this.createMetadata({
      purchaseOrderId,
      error: error?.message || 'Unknown error',
      stack: error?.stack || '',
      stage
    }, 'PROCESSING_ERROR');
    
    this.error('Error during purchase order processing', metadata);
  }
}

module.exports = PurchaseOrderLogger;