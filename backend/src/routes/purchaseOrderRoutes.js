const express = require('express');
const router = express.Router();
const PurchaseOrderController = require('../controllers/purchaseOrderController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post(
    '/upload',
    authMiddleware,               
    PurchaseOrderController.uploadMiddleware,
    PurchaseOrderController.uploadPurchaseOrder
);

module.exports = router;
