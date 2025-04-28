const multer = require('multer');

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        message: 'File size exceeds 20MB limit'
      });
    }
    return res.status(400).json({ 
      message: `Upload error: ${err.message}`
    });
  }
  next(err);
};

module.exports = handleMulterError; 