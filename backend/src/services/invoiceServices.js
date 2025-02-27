const path = require("path");

class InvoiceService {
    constructor() {

    }
  
    async uploadInvoice() {
      return {
        message: "Invoice upload service called"
      };
    }

    /**
     * Validates if a file is a valid PDF
     * This function checks three criteria to determine if a file is a valid PDF:
     * 1. The MIME type must be "application/pdf"
     * 2. The file extension must be ".pdf"
     * 3. The file content must begin with the PDF signature "%PDF-"
     * 
     * @param {Buffer} fileBuffer - The file content as a buffer
     * @param {string} mimeType - The MIME type of the file
     * @param {string} fileName - The original filename with extension
     * @returns {Promise<boolean>} Returns true if validation passes, throws an error otherwise
     * @throws {Error} Throws an error with a specific message if validation fails
     */
    async validatePDF(fileBuffer, mimeType, fileName) {
        if (mimeType !== "application/pdf") {
            throw new Error("Invalid MIME type");
        }

        const validExtensions = [".pdf"];
        const fileExtension = path.extname(fileName).toLowerCase();
        if (!validExtensions.includes(fileExtension)) {
            throw new Error("Invalid file extension");
        }

        const pdfSignature = "%PDF-";
        const fileHeader = fileBuffer.slice(0, 5).toString();
        if (fileHeader !== pdfSignature) {
            throw new Error("Invalid PDF file");
        }

        return true;
    }

  /**
   * Validates the size of a file
   * @param {Buffer} fileBuffer - The file buffer to validate
   * @returns {Promise<boolean>} - Returns true if validation passes
   * @throws {Error} - Throws an error if validation fails
   */
  async validateSizeFile(fileBuffer) {
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File exceeds maximum allowed size of 20MB`);
    }

    return true;
  }

  /**
   * Checks if a PDF file is encrypted.
   * 
   * This function analyzes a PDF buffer to determine if it's encrypted
   * by searching for the '/Encrypt' entry in the PDF trailer section.
   * 
   * @param {Buffer} pdfBuffer - Buffer containing the PDF file data to check
   * @returns {boolean} - Returns true if the PDF is encrypted, false otherwise
   */
  async isPdfEncrypted(pdfBuffer) {
    const bufferSize = pdfBuffer.length;
    const searchSize = Math.min(bufferSize, 8192); 
    
    const pdfTrailer = pdfBuffer.slice(bufferSize - searchSize).toString('utf-8');
    return pdfTrailer.includes('/Encrypt');
  }
}
   
module.exports = new InvoiceService();
  