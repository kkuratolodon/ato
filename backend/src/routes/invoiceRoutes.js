const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

router.post('/upload', invoiceController.uploadInvoice);

module.exports = router;
