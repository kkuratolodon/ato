const pdfValidationService = require('../services/pdfValidationService');
const { safeResponse } = require('../utils/responseHelper');

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
      if (res.headersSent) return; //  Prevent sending a duplicate response

      if (req.query && req.query.simulateTimeout === "true") {
        return safeResponse(res, 504, "Server timeout - upload processing timed out");

      }
      if (!req.user) {
        return safeResponse(res, 401, "Unauthorized");
      }
  
      if (!req.file) {
        return safeResponse(res, 400, "No file uploaded");
      }
  
      const { buffer, originalname, mimetype } = req.file;
      const partnerId = req.user.uuid;
      
      try {
        await this.executeWithTimeout(async () => {
          // File type validation
          try {
            await pdfValidationService.validatePDF(buffer, mimetype, originalname);
          } catch (error) {
            return safeResponse(res, 415, "File format is not PDF");
          }
  
          // Encryption check
          const isEncrypted = await pdfValidationService.isPdfEncrypted(buffer);
          if (isEncrypted) {
            return safeResponse(res, 400, "PDF is encrypted");
          }
  
          // Integrity check
          const isValidPdf = await pdfValidationService.checkPdfIntegrity(buffer);
          if (!isValidPdf) {
            return safeResponse(res, 400, "PDF file is invalid");
          }
  
          // File size validation
          try {
            await pdfValidationService.validateSizeFile(buffer);
          } catch (error) {
            return safeResponse(res, 413, "File size exceeds maximum limit");
          }
          try{
            let result;
            if (this.documentType === "Invoice") {
                result = await this.service.uploadInvoice({
                    originalname, buffer, mimetype, partnerId,
                });
                return safeResponse(res, 200, result);
            } 
            else if (this.documentType === "Purchase Order") {
                result = await this.service.uploadPurchaseOrder({
                    originalname, buffer, mimetype, partnerId,
                });
                return safeResponse(res, 200, result);
            }
            else{
              throw new Error("document type unknown")
            }
          }catch(error){
            console.error("Unhandled error in upload process:", error);
            if(error.message === "document type unknown"){
              return safeResponse(res, 400, "Invalid document type provided" );
            }
            return safeResponse(res, 500, "Internal server error");
          }
        });
      } catch (error) {
        if (error.message === "Timeout") {
          return safeResponse(res, 504, "Server timeout - upload processing timed out");
        }
        console.error("Unexpected error:", error);
        return safeResponse(res, 500, "Internal server error");
      }
    }
  }
  
  module.exports = FinancialDocumentController;
  