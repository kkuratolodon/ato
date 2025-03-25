const express = require('express');
const router = express.Router();
const { controller: invoiceController, uploadMiddleware } = require('../controllers/invoiceController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/debug-sentry', () => {
    throw new Error("Sentry error dummy!");
});

router.post(
    '/upload',
    authMiddleware,               
    uploadMiddleware,
    invoiceController.uploadInvoice
);

router.get('/:id', authMiddleware, invoiceController.getInvoiceById);

module.exports = router;
