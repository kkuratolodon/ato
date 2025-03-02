const invoiceService = require('../services/invoiceService');
const authService = require('../services/authService');
const multer = require('multer');
const upload = multer();

exports.uploadMiddleware = upload.single('file');

exports.uploadInvoice = async (req, res) => {
  const { client_id, client_secret } = req.body;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    //fungsi auth sebelum upload
    const isAuthorized = await authService.authenticate(client_id, client_secret);
    if (!isAuthorized) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    //jika auth valid, lanjutkan ke upload file PDF
    const result = await invoiceService.uploadInvoice(req.file);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in uploadInvoice:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
