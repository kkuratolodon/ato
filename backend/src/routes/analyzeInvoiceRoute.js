const express = require('express');
const router = express.Router();
const analyzeInvoiceController = require('../controllers/analyzeInvoiceController');

router.post('/analyze', analyzeInvoiceController.analyzeInvoice);

router.all('/analyze', (req, res) => {
    res.status(405).json({ message: "Method not allowed" });
});

router.all('*', (req, res) => {
    res.status(404).json({ message: "Endpoint not found" });
});

module.exports = router;