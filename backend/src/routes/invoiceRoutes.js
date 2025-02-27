const express = require('express');
const router = express.Router();
const InvoiceController = require('../controllers/invoiceController')

router.post('/upload', InvoiceController.uploadMiddleware,InvoiceController.uploadInvoice);

module.exports = router
