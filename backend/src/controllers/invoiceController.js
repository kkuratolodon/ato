const InvoiceService = require('../services/invoiceService');
const multer = require('multer');
const FinancialDocumentController = require('./financialDocumentController');

const upload = multer({
  storage: multer.memoryStorage()
});
exports.uploadMiddleware = upload.single('file');
/**
 * Handles the upload and validation of invoice PDF files with an automatic 3-second timeout.
 *
 * This function performs multiple validation steps on the uploaded file:
 * 1. Authentication: Verifies client credentials before processing.
 * 2. Timeout Protection: Automatically terminates the request if it exceeds 3 seconds.
 * 3. File Type Validation: Ensures the uploaded file is a valid PDF.
 * 4. Encryption Check: Rejects encrypted PDFs.
 * 5. Integrity Check: Verifies the PDF is not corrupted.
 * 6. Size Validation: Ensures the file does 2not exceed the allowed size limit.
 * 7. Upload Process: Uploads the validated invoice file.
 *
 * The function uses a Promise.race mechanism to implement the timeout, ensuring that
 * the server responds in a timely manner even when processing large files or experiencing
 * unexpected delays in the validation or upload process.
 *
 * @param {Object} req - Express request object containing the uploaded file and request data.
 * @param {Object} req.file - Uploaded file information from Multer middleware.
 * @param {Buffer} req.file.buffer - File content in buffer format.
 * @param {string} req.file.originalname - Original filename including extension.
 * @param {string} req.file.mimetype - MIME type of the file.
 * @param {Object} req.user - Request containing authentication credentials.
 * @param {string} req.user.uuid - Unique identifier for the partner/user uploading the file.
 * @param {Object} res - Express response object.
 * @returns {Promise<Object>} JSON response with appropriate status code and message.
 *
 * @throws {Error} Returns specific error messages for each validation failure.
 * Returns a 504 Gateway Timeout response if processing exceeds 3 seconds.
 * Logs internal server errors to the console but provides a generic response to the client.
 */

class InvoiceController extends FinancialDocumentController{
  constructor(){
    super(InvoiceService, "Invoice");
  }
}

const invoiceController = new InvoiceController();
exports.uploadInvoice = async (req, res) => {
  return invoiceController.uploadFile(req, res);
  
};

/**
 * @description Retrieves an invoice by ID with authorization check.
 *
 * @throws {400} Invalid invoice ID (non-numeric, null, or negative)
 * @throws {401} Unauthorized if req.user is missing
 * @throws {403} Forbidden if invoice does not belong to the authenticated user
 * @throws {404} Not Found if invoice is not found
 * @throws {500} Internal Server Error 
 */
exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({message: "Invoice ID is required"});
    }
    
    if (!req.user) {
      return res.status(401).json({message: "Unauthorized"});
    }
    const invoicePartnerId = await InvoiceService.getPartnerId(id);
    
    if(invoicePartnerId !== req.user.uuid){
      return res.status(403).json({message: "Forbidden: You do not have access to this invoice"});
    }

    // Method getInvoiceById sudah diubah untuk menerima UUID
    const invoiceDetail = await InvoiceService.getInvoiceById(id);

    return res.status(200).json(invoiceDetail);
  } catch (error) {
    if (error.message === "Invoice not found") {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Analyzes an invoice document using Azure Form Recognizer and optionally saves to database
 */
exports.analyzeInvoice = async (req, res) => {
  const { documentUrl } = req.body;
  const partnerId = req.user?.uuid; 
  if (!documentUrl) {
    return res.status(400).json({ message: "documentUrl is required" });
  }
  if (!partnerId) {
    return res.status(401).json({ message: "Unauthorized. User information not available." });
  }

  try {
    // Analisis dokumen, mapping, dan simpan ke database
    const result = await InvoiceService.analyzeInvoice(documentUrl, partnerId);
    
    if (!result?.savedInvoice) {
      return res.status(500).json({ message: "Failed to analyze invoice: no saved invoice returned" });
    }
    
    return res.status(200).json({
      message: "Invoice analyzed and saved to database",
      rawData: result.rawData,
      invoiceData: result.invoiceData,
      savedInvoice: result.savedInvoice
    });
  } catch (error) {
    if (error.message.includes("Invalid date format") || error.message === "Invoice contains invalid date format") {
      return res.status(400).json({ message: error.message });
    } else if (error.message === "Failed to process the document") {
      return res.status(400).json({ message: error.message });
    } else {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }
};
