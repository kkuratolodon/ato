const winston = require('winston');
const { format } = winston;

/**
 * BaseLogger - A base class for implementing logging functionality
 * This class follows the Open/Closed principle by allowing extension
 * without modification of the base logger behavior
 */
class BaseLogger {
  /**
   * Create a logger with service-specific configuration
   * @param {string} serviceName - Name of the service (e.g., 'invoice-service')
   * @param {string} logFileName - Base name for log files (e.g., 'invoice')
   */
  constructor(serviceName, logFileName) {
    this.logger = winston.createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json(),
        format.errors({ stack: true })
      ),
      defaultMeta: { service: serviceName },
      transports: [
        // Write all logs to console
        new winston.transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        // Write all logs with level 'error' and below to service-specific error log
        new winston.transports.File({ 
          filename: `logs/${logFileName}-error.log`, 
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        // Write all logs with level 'info' and below to service-specific log
        new winston.transports.File({ 
          filename: `logs/${logFileName}.log`,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      ]
    });
  }

  /**
   * Log an informational message
   * @param {string} message - The log message
   * @param {Object} metadata - Additional metadata to log
   */
  info(message, metadata) {
    this.logger.info(message, metadata);
  }

  /**
   * Log a warning message
   * @param {string} message - The log message
   * @param {Object} metadata - Additional metadata to log
   */
  warn(message, metadata) {
    this.logger.warn(message, metadata);
  }

  /**
   * Log an error message
   * @param {string} message - The log message
   * @param {Object} metadata - Additional metadata to log
   */
  error(message, metadata) {
    this.logger.error(message, metadata);
  }

  /**
   * Create a standardized metadata object with an event type
   * @param {Object} data - The data to include in metadata
   * @param {string} eventType - Type of event being logged
   * @returns {Object} Metadata object with event field
   */
  createMetadata(data, eventType) {
    return {
      ...data,
      event: eventType
    };
  }
}

module.exports = BaseLogger;