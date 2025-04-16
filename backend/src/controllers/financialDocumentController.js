const pdfValidationService = require('../services/pdfValidationService');
const { safeResponse } = require('../utils/responseHelper');
const { ValidationError, AuthError, ForbiddenError, PayloadTooLargeError, UnsupportedMediaTypeError } = require('../utils/errors');
const Sentry = require('@sentry/node');

class FinancialDocumentController {
  constructor(service, documentType) {
    this.service = service;
    this.documentType = documentType;
  }

  async executeWithTimeout(fn, timeoutMs = process.env.UPLOAD_TIMEOUT || 3000) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    });

    try {
      return await Promise.race([
        fn().finally(() => clearTimeout(timeoutId)),
        timeoutPromise
      ]);
    } catch (error) {
      console.error(error)
      throw error;
    }
  }

  async uploadFile(req, res) {       
    try {
      await this.executeWithTimeout(async () => {
        await this.validateUploadRequest(req);
        await this.validateUploadFile(req.file);
        const result = await this.processUpload(req);
        return safeResponse(res, 200, result);
      });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async validateUploadRequest(req) {
    if (!req.user) {
      throw new AuthError("Unauthorized");
    }
    if (!req.file) {
      throw new ValidationError("No file uploaded");
    }
  }

  async validateUploadFile(file) {
    const { buffer, mimetype, originalname } = file;
    try {
      await pdfValidationService.allValidations(buffer, mimetype, originalname);
    } catch (error) {
      if (error instanceof UnsupportedMediaTypeError || error instanceof PayloadTooLargeError) {
        throw error; 
      }
      throw new ValidationError(error.message);
    } 
  }

  // make sure to implement this method in child
  // eslint-disable-next-line no-unused-vars
  async processUpload(_req) {
    throw new Error('processUpload must be implemented by child classes');
  }

  handleError(res, error) {
    if (error instanceof ValidationError) {
      return safeResponse(res, 400, error.message);
    }
    if (error instanceof AuthError) {
      return safeResponse(res, 401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return safeResponse(res, 403, error.message);
    }
    if (error instanceof PayloadTooLargeError) {
      return safeResponse(res, 413, error.message);
    }
    if (error instanceof UnsupportedMediaTypeError) {
      return safeResponse(res, 415, error.message);
    }
    if (error.message === "Timeout") {
      return safeResponse(res, 504, "Server timeout - upload processing timed out");
    }
    console.error("Unexpected error:", error);
    return safeResponse(res, 500, "Internal server error");
  }

}

module.exports = FinancialDocumentController;
