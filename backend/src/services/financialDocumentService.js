const s3Service = require("./s3Service")
const DocumentStatus = require('../models/enums/DocumentStatus');

class FinancialDocumentService {
  constructor(documentType, s3Service, logger = console) {
    this.documentType = documentType;
    this.s3Service = s3Service;
    this.logger = logger;
  }

  async uploadFile({ buffer, partnerId }) {
    if (!partnerId) {
      throw new Error("Partner ID is required");
    }
    const s3Url = await s3Service.uploadFile(buffer);
    if (!s3Url) {
      throw new Error("Failed to upload file to S3");
    }
    return {
      status: DocumentStatus.PROCESSING,
      partner_id: partnerId,
      file_url: s3Url
    };
  }
  
  /**
   * Upload OCR analysis results as JSON to S3
   * @param {Object} analysisResults - The OCR analysis results object
   * @param {string} documentId - Identifier for the original document
   * @returns {Promise<string>} - URL of the uploaded JSON file
   */
  async uploadAnalysisResults(analysisResults, documentId) {
    if (!analysisResults) {
      throw new Error("Analysis results are required");
    }
    
    try {
      // Upload the JSON data to S3
      const jsonUrl = await s3Service.uploadJsonResult(analysisResults, documentId);
      
      if (!jsonUrl) {
        throw new Error("Failed to upload analysis results to S3");
      }
      return jsonUrl;
    } catch (error) {
      console.error("Error uploading analysis results:", error);
      throw new Error(`Failed to store analysis results: ${error.message}`);
    }
  }
}

module.exports = FinancialDocumentService;