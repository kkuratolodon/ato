const pdfValidationService = require('../services/pdfValidationService');
const PdfDecryptionService = require('../services/pdfDecryptionService');
const QpdfDecryption = require('../strategies/qpdfDecryption');
const { safeResponse } = require('../utils/responseHelper');
const { ValidationError, AuthError, ForbiddenError, PayloadTooLargeError, UnsupportedMediaTypeError, NotFoundError } = require('../utils/errors');

class FinancialDocumentController {
  constructor(service, documentType) {
    this.service = service;
    this.documentType = documentType;
      // Initialize PDF decryption service with QPDF strategy
      this.pdfDecryptionService = new PdfDecryptionService(new QpdfDecryption());
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
      // Don't log validation errors to console, they're expected errors
      if (!(error instanceof ValidationError)) {
        console.error(error);
      }
      throw error;
    }
  }

  async uploadFile(req, res) {
    try {
      await this.executeWithTimeout(async () => {
        await this.validateUploadRequest(req);
        
        // Check if the file is encrypted
        const validationResult = await this.validateUploadFile(req.file);
        
        // If file is encrypted
        if (validationResult && validationResult.isEncrypted) {
          // If password is provided in the request body, try to decrypt
          if (req.body && req.body.password) {
            try {
              // Attempt to decrypt the PDF with the provided password
              const decryptedBuffer = await this.pdfDecryptionService.decrypt(
                validationResult.buffer, 
                req.body.password
              );
              
              // Replace the encrypted buffer with the decrypted one
              req.file.buffer = decryptedBuffer;
              
              // Continue with normal processing using decrypted file
              const result = await this.processUpload(req);
              return safeResponse(res, 200, result);
            } catch (error) {
              // Handle decryption errors
              if (error.message.includes("Incorrect password")) {
                throw new ValidationError("Incorrect password for encrypted PDF");
              }
              throw new ValidationError(`Failed to decrypt PDF: ${error.message}`);
            }
          } else {
            // No password provided, inform client that password is required
            return safeResponse(res, 403, {
              message: "PDF is encrypted and requires a password",
              requiresPassword: true
            });
          }
        }
        
        // Process non-encrypted file normally
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
      const validationResult = await pdfValidationService.allValidations(buffer, mimetype, originalname);
      
      // If PDF is encrypted, store the buffer and return encrypted status
      if (validationResult.isEncrypted) {
        return { isEncrypted: true, buffer, filename: originalname };
      }
      
      return { isEncrypted: false };
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
      // Special case for password errors - don't log these
      if (error.message.includes("Incorrect password for encrypted PDF") || 
          error.message.includes("PDF is encrypted")) {
        // Just send the response without logging
        return safeResponse(res, 400, error.message);
      }
      
      return safeResponse(res, 400, error.message);
    }
    
    if (error instanceof AuthError) {
      return safeResponse(res, 401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return safeResponse(res, 403, error.message);
    }
    if (error instanceof NotFoundError) {
      return safeResponse(res, 404, error.message);
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
