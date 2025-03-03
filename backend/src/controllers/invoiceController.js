const invoiceService = require('../services/invoiceServices');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
});

/**
 * Middleware for handling file uploads
 * This middleware uses Multer to process a single file upload and validates 
 * that a file was actually provided in the request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void} Calls next middleware or returns 400 error response if no file
 */
exports.uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, () => {
      if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
      }
      
      next();
  });
};

/**
* Handles the upload and validation of invoice PDF files
* This function performs multiple validation steps on the uploaded file:
* 1. Validates the file is a proper PDF
* 2. Checks if the PDF is encrypted
* 3. Validates PDF file integrity
* 4. Checks if the file size is within limits
* 5. Uploads the validated invoice
* 
* @param {Object} req - Express request object containing the uploaded file and query parameters
* @param {Object} req.file - The uploaded file information from Multer middleware
* @param {Buffer} req.file.buffer - The file content as a buffer
* @param {string} req.file.originalname - The original filename with extension
* @param {string} req.file.mimetype - The MIME type of the file
* @param {Object} req.query - Query parameters from the request
* @param {string} [req.query.simulateTimeout] - Optional parameter to simulate a timeout
* @param {Object} res - Express response object
* @returns {Promise<Object>} JSON response with appropriate status code and message
* @throws {Error} Logs errors to console but always returns an appropriate response to client
*/
exports.uploadInvoice = async (req, res) => {
  try {
    // 1. Pastikan user sudah di-set oleh authMiddleware
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { buffer, originalname, mimetype } = req.file;

    if (req.query.simulateTimeout === 'true') {
      return res.status(504).json({ message: "Server timeout during upload" });
    }

    // 3. Validasi bahwa file benar-benar PDF
    try {
      await invoiceService.validatePDF(buffer, mimetype, originalname);
    } catch (error) {
      return res.status(415).json({ message: "File format is not PDF" });
    }

    // 4. Cek apakah PDF terenkripsi
    const isEncrypted = await invoiceService.isPdfEncrypted(buffer);
    if (isEncrypted) {
      return res.status(400).json({ message: "pdf is encrypted" });
    }

    // 5. Cek integritas PDF
    const isValidPdf = await invoiceService.checkPdfIntegrity(buffer);
    if (!isValidPdf) {
      return res.status(400).json({ message: "PDF file is invalid" });
    }

    // 6. Validasi ukuran file
    try {
      await invoiceService.validateSizeFile(buffer);
    } catch (error) {
      return res.status(413).json({ message: "File size exceeds maximum limit" });
    }

    // 7. Jika semua valid, lanjutkan proses upload
    const result = await invoiceService.uploadInvoice(req.file);
    return res.status(501).json(result);

  } catch (error) {
    console.log("DEBUG: Internal Server Error", error.stack);
    return res.status(500).json({ message: "Internal server error" });
  }
};