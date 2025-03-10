const pdfValidationService = require('../services/pdfValidationService');
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
        return res.status(504).json({ message: "Server timeout - upload exceeded 3 seconds" });
      }
  
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
  
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
  
      const { buffer, originalname, mimetype } = req.file;
      const partnerId = req.user.uuid;
      
      try {
        await this.executeWithTimeout(async () => {
          // File type validation
          try {
            await pdfValidationService.validatePDF(buffer, mimetype, originalname);
          } catch (error) {
            if (!res.headersSent) return res.status(415).json({ message: "File format is not PDF" });
          }
  
          // Encryption check
          const isEncrypted = await pdfValidationService.isPdfEncrypted(buffer);
          if (isEncrypted) {
            if (!res.headersSent) return res.status(400).json({ message: "PDF is encrypted" });
          }
  
          // Integrity check
          const isValidPdf = await pdfValidationService.checkPdfIntegrity(buffer);
          if (!isValidPdf) {
            if (!res.headersSent) return res.status(400).json({ message: "PDF file is invalid" });
          }
  
          // File size validation
          try {
            await pdfValidationService.validateSizeFile(buffer);
          } catch (error) {
            if (!res.headersSent) return res.status(413).json({ message: "File size exceeds maximum limit" });
          }
          try{
            let result;
            if (this.documentType === "Invoice") {
                result = await this.service.uploadInvoice({
                    originalname, buffer, mimetype, partnerId,
                });
                if (!res.headersSent) return res.status(200).json(result);
            } 
            else if (this.documentType === "Purchase Order") {
                result = await this.service.uploadPurchaseOrder({
                    originalname, buffer, mimetype, partnerId,
                });
                if (!res.headersSent) return res.status(200).json(result);
            }
    

          }catch(error){
            console.error("Unhandled error in upload process:", error);
            if (!res.headersSent) return res.status(500).json({ message: "Internal server error" });
          }
        }, 3000);
      } catch (error) {
        if (error.message === "Timeout") {
          if (!res.headersSent) return res.status(504).json({ message: "Server timeout - upload exceeded 3 seconds" });
        }
        console.error("Unexpected error:", error);
        if (!res.headersSent) return res.status(500).json({ message: "Internal server error" });
      }
    }
  }
  
  module.exports = FinancialDocumentController;
  