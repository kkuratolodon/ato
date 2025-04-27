const multer = require('multer');
const handleMulterError = require('./multerErrorHandler');

// Basic multer setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
}).single('file');

module.exports = (req, res, next) => {
  // Pass the original next function directly to upload
  upload(req, res, next);
};