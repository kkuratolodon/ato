const s3Service = require("./s3Service")

class FinancialDocumentService{
  constructor(documentType){
    this.documentType = documentType;
  }

  async uploadFile({ buffer, originalname, partnerId }){
    if (!partnerId) {
      throw new Error("Partner ID is required");
    }
    const s3Url = await s3Service.uploadFile(buffer);
    if (!s3Url) {
      throw new Error("Failed to upload file to S3");
    }
    return {
      status: "Processing",
      partner_id: partnerId,
      file_url: s3Url
    };
  }
}
module.exports = FinancialDocumentService;