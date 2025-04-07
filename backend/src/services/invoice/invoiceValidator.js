class InvoiceValidator {
    validateFileData(fileData) {
      if (!fileData) {
        throw new Error("File not found");
      }
      const { partnerId } = fileData;
      if (!partnerId) {
        throw new Error("Partner ID is required");
      }
    }
  }
  
  module.exports = InvoiceValidator;