const multer = require('multer');
const handleMulterError = require('./multerErrorHandler');

// Basic multer setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
}).single('file');

module.exports = async (req, res, next) => {
  try {
    upload(req, res, next); 
  } catch (error) {
    handleMulterError(error, req, res, next)
  }
}