const express = require('express');
const router = express.Router();
const InvoiceController = require('../controllers/invoiceController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post(
    '/upload',
    authMiddleware,               
    InvoiceController.uploadMiddleware,
    InvoiceController.uploadInvoice
  );
  
  module.exports = router;