const winston = require('winston');
const { format } = winston;

// Configure the logger
const logger = winston.createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json(),
    format.errors({ stack: true })
  ),
  defaultMeta: { service: 'purchase-order-service' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    // Write all logs with level 'error' and below to 'error.log'
    new winston.transports.File({ 
      filename: 'logs/purchase-order-error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with level 'info' and below to 'purchase-order.log'
    new winston.transports.File({ 
      filename: 'logs/purchase-order.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

class PurchaseOrderLogger {
  static logStatusRequest(purchaseOrderId, status) {
    logger.info('Purchase order status requested', {
      purchaseOrderId,
      status,
      event: 'STATUS_REQUEST'
    });
  }

  static logStatusNotFound(purchaseOrderId) {
    logger.warn('Purchase order status not found', {
      purchaseOrderId,
      event: 'STATUS_NOT_FOUND'
    });
  }

  static logStatusError(purchaseOrderId, error) {
    logger.error('Error retrieving purchase order status', {
      purchaseOrderId,
      error: error?.message || 'Unknown error',
      stack: error?.stack || '',
      event: 'STATUS_ERROR'
    });
  }
}

module.exports = PurchaseOrderLogger;