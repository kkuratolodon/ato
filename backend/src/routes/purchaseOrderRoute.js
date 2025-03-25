const express = require('express');
const router = express.Router();
const { purchaseOrderController, uploadMiddleware } = require('../controllers/purchaseOrderController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post(
    '/upload',
    authMiddleware,               
    uploadMiddleware,
    purchaseOrderController.uploadPurchaseOrder
);

module.exports = router;
