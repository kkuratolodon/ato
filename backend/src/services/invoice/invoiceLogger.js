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
  defaultMeta: { service: 'invoice-service' },
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
      filename: 'logs/invoice-error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with level 'info' and below to 'invoice.log'
    new winston.transports.File({ 
      filename: 'logs/invoice.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

class InvoiceLogger {
  static logUploadStart(invoiceId, partnerId, filename) {
    logger.info('Invoice upload initiated', {
      invoiceId,
      partnerId,
      filename,
      event: 'UPLOAD_START'
    });
  }

  static logUploadSuccess(invoiceId, s3Url) {
    logger.info('Invoice uploaded to S3', {
      invoiceId,
      s3Url,
      event: 'UPLOAD_SUCCESS'
    });
  }

  static logProcessingStart(invoiceId) {
    logger.info('Starting invoice processing', {
      invoiceId,
      event: 'PROCESSING_START'
    });
  }

  static logAnalysisComplete(invoiceId, jsonUrl) {
    logger.info('Invoice analysis completed', {
      invoiceId,
      jsonUrl,
      event: 'ANALYSIS_COMPLETE'
    });
  }

  static logDataMappingComplete(invoiceId, dataSummary) {
    logger.info('Invoice data mapping completed', {
      invoiceId,
      dataSummary,
      event: 'MAPPING_COMPLETE'
    });
  }

  static logProcessingComplete(invoiceId) {
    logger.info('Invoice processing completed successfully', {
      invoiceId,
      event: 'PROCESSING_COMPLETE'
    });
  }

  static logError(invoiceId, error, stage) {
    logger.error('Error during invoice processing', {
      invoiceId,
      error: error.message,
      stack: error.stack,
      stage,
      event: 'PROCESSING_ERROR'
    });
  }

  static logValidationError(invoiceId, error) {
    logger.warn('Invoice validation failed', {
      invoiceId,
      error: error.message,
      event: 'VALIDATION_ERROR'
    });
  }
}

module.exports = InvoiceLogger; 