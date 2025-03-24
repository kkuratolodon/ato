const express = require('express');
const router = express.Router();
const InvoiceController = require('../controllers/invoiceController');
const authMiddleware = require('../middlewares/authMiddleware');
const apiLimiter = require('../middlewares/rateLimitMiddleware');

router.get('/debug-sentry', () => {
    throw new Error("Sentry error dummy!");
});

router.post(
    '/upload',
    apiLimiter,
    authMiddleware,               
    InvoiceController.uploadMiddleware,
    InvoiceController.uploadInvoice
);

router.get(
    '/:id', 
    apiLimiter,
    authMiddleware,
    InvoiceController.getInvoiceById
);

router.post('/analyze', InvoiceController.analyzeInvoice);

module.exports = router;
