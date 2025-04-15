const multer = require('multer');
const pdfValidationService = require('../services/pdfValidationService');
const { PayloadTooLargeError, UnsupportedMediaTypeError } = require('../utils/errors');
const handleMulterError = require('./multerErrorHandler')

// Basic multer setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
}).single('file');

// Comprehensive file validation middleware
const validateFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { buffer, mimetype, originalname } = req.file;

    // PDF validation
    await pdfValidationService.validatePDF(buffer, mimetype, originalname);
    
    // Encryption check
    const isEncrypted = await pdfValidationService.isPdfEncrypted(buffer);
    if (isEncrypted) {
      return res.status(400).json({ message: 'Encrypted PDFs are not allowed' });
    }

    // Page count validation
    await pdfValidationService.validatePdfPageCount(buffer);

    next();
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return res.status(413).json({ message: error.message });
    }
    if (error instanceof UnsupportedMediaTypeError) {
      return res.status(415).json({ message: error.message });
    }
    next(error);
  }
};

module.exports = async (req, res, next) => {
  try {
    upload(req, res, next); 
  } catch (error) {
    handleMulterError(error, req, res, next)
  }
  validateFile(req, res, next); 
}