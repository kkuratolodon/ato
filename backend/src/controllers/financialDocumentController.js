const pdfValidationService = require('../services/pdfValidationService');
const { safeResponse } = require('../utils/responseHelper');
const { ValidationError, AuthError, ForbiddenError } = require('../utils/errors');

class FinancialDocumentController {
  constructor(service, documentType) {
    this.service = service;
    this.documentType = documentType;
  }

  async executeWithTimeout(fn, timeoutMs = 3000) {
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
        await this.validateRequest(req);
        await this.validateFile(req.file);
        const result = await this.processUpload(req);
        return safeResponse(res, 200, result);
      });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async validateRequest(req) {
    if (!req.user) {
      throw new AuthError("Unauthorized");
    }
    if (!req.file) {
      throw new ValidationError("No file uploaded");
    }
  }

  async validateFile(file) {
    const { buffer, mimetype, originalname } = file;
    try {
      await pdfValidationService.validatePDF(buffer, mimetype, originalname);
    } catch (error) {
      throw new ValidationError(error.message); 
    }
  }

  // make sure to implement this method in child
  async processUpload(_req) {
    _req; 
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
    if (error.message === "Timeout") {
      return safeResponse(res, 504, "Server timeout - upload processing timed out");
    }
    console.error("Unexpected error:", error);
    return safeResponse(res, 500, "Internal server error");
  }

}

module.exports = FinancialDocumentController;
  