const express = require('express');
const router = express.Router();
const analyzeInvoiceController = require('../controllers/analyzeInvoiceController');

router.post('/analyze', analyzeInvoiceController.analyzeInvoice);

module.exports = router;