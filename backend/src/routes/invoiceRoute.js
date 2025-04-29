const express = require('express');
const router = express.Router();
const { controller } = require('../controllers/invoiceController');
const authMiddleware = require('@middlewares/authMiddleware');
// const apiLimiter = require('@middlewares/rateLimitMiddleware');
const uploadMiddleware = require('@middlewares/uploadMiddleware');

router.get('/debug-sentry', () => {
    throw new Error("Sentry error dummy!");
});

router.post(
    '/upload',
    authMiddleware,               
    uploadMiddleware,
    controller.uploadInvoice
);

// More specific routes should be placed before general routes
router.get(
    '/:id/status',
    authMiddleware,
    controller.getInvoiceStatus
);

router.get(
    '/:id', 
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
