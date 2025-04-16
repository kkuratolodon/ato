const express = require('express');
const router = express.Router();
const { InvoiceController } = require('../controllers/invoiceController');
const authMiddleware = require('../middlewares/authMiddleware');
const apiLimiter = require('../middlewares/rateLimitMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');
const invoiceService = require('../services/invoice/invoiceService');

let controller = new InvoiceController(invoiceService, 'invoice');

router.get('/debug-sentry', () => {
    throw new Error("Sentry error dummy!");
});

router.post(
    '/upload',
    apiLimiter,
    authMiddleware,               
    uploadMiddleware,
    controller.uploadInvoice
);

router.get(
    '/:id', 
    apiLimiter,
    authMiddleware,
    controller.getInvoiceById
);

// TODO: tanya ini apakah ga mau dikasih api limiter juga? 
router.delete(
    '/:id', 
    authMiddleware, 
    controller.deleteInvoiceById
);

module.exports = router;
