const multer = require('multer');
// Basic multer setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
}).single('file');

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ 
          message: 'File size exceeds 20MB limit'
        });
      }
      return res.status(400).json({ 
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return next(err);
    }
    next();
  });
};