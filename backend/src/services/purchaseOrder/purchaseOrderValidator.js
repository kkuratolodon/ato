class PurchaseOrderValidator {
  validateFileData(fileData) {
    if (!fileData) {
      throw new Error("Missing file data");
    }

    if (!fileData.buffer || !fileData.buffer.length) {
      throw new Error("Invalid file: empty or missing content");
    }

    if (!fileData.originalname) {
      throw new Error("Invalid file: missing filename");
    }

    if (!fileData.partnerId) {
      throw new Error("Partner ID is required");
    }

    // Add more validation rules as needed
    return true;
  }
}

module.exports = PurchaseOrderValidator;
