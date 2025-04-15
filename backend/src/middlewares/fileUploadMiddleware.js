const multer = require('multer');
const pdfValidationService = require('../services/pdfValidationService');
const { PayloadTooLargeError, UnsupportedMediaTypeError } = require('../utils/errors');

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

// Combine middlewares
const uploadMiddleware = [upload, validateFile];

module.exports = uploadMiddleware;

// TODO: clean this, this is old mutler conig from controller 
// const upload = multer({
//     storage: multer.memoryStorage(), 
//     limits: {
//       fileSize: 20 * 1024 * 1024 // 20MB size limit
//     }
//   });
  
//   const handleMulterError = (err, req, res, next) => {
//     if (err instanceof multer.MulterError) {
//       if (err.code === 'LIMIT_FILE_SIZE') {
//         return res.status(413).json({ 
//           message: 'File size exceeds the 20MB limit'
//         });
//       }
//       return res.status(400).json({ 
//         message: `Upload error: ${err.message}`
//       });
//     }
//     next(err);
//   };
  
// exports.uploadMiddleware = [upload.single('file'), handleMulterError];

// TODO: remove this, the old processUpload from invoiceController 
// async processUpload(req) {
//     const { buffer, originalname, mimetype } = req.file;
//     const partnerId = req.user.uuid;

//     if (!buffer || !originalname || !mimetype || !partnerId) {  
//       throw new ValidationError('Missing required upload parameters');  
//     } 

//     return await this.service.uploadInvoice({
//       buffer,
//       originalname,
//       mimetype,
//       partnerId
//     })
//   }