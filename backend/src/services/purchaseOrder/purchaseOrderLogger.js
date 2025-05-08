const PurchaseOrderLogger = require('../../utils/logger/PurchaseOrderLogger');

/**
 * This is a compatibility adapter for the PurchaseOrderLogger class
 * It maintains backward compatibility with code that expects the previous static class methods
 * while using the new, more SOLID logger implementation under the hood
 */
class PurchaseOrderLoggerAdapter {
  static logStatusRequest(purchaseOrderId, status) {
    return PurchaseOrderLogger.getInstance().logStatusRequest(purchaseOrderId, status);
  }

  static logStatusNotFound(purchaseOrderId) {
    return PurchaseOrderLogger.getInstance().logStatusNotFound(purchaseOrderId);
  }

  static logStatusError(purchaseOrderId, error) {
    return PurchaseOrderLogger.getInstance().logStatusError(purchaseOrderId, error);
  }

  static logUploadStart(purchaseOrderId, partnerId, filename) {
    return PurchaseOrderLogger.getInstance().logUploadStart(purchaseOrderId, partnerId, filename);
  }

  static logUploadSuccess(purchaseOrderId, s3Url) {
    return PurchaseOrderLogger.getInstance().logUploadSuccess(purchaseOrderId, s3Url);
  }

  static logProcessingStart(purchaseOrderId) {
    return PurchaseOrderLogger.getInstance().logProcessingStart(purchaseOrderId);
  }

  static logAnalysisComplete(purchaseOrderId, jsonUrl) {
    return PurchaseOrderLogger.getInstance().logAnalysisComplete(purchaseOrderId, jsonUrl);
  }

  static logProcessingComplete(purchaseOrderId) {
    return PurchaseOrderLogger.getInstance().logProcessingComplete(purchaseOrderId);
  }

  static logError(purchaseOrderId, error, stage) {
    return PurchaseOrderLogger.getInstance().logError(purchaseOrderId, error, stage);
  }
}

module.exports = PurchaseOrderLoggerAdapter;