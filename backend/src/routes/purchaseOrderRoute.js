const express = require('express');
const router = express.Router();
const { controller } = require('@controllers/purchaseOrderController');
const authMiddleware = require('@middlewares/authMiddleware');
const uploadMiddleware = require('@middlewares/uploadMiddleware');

router.post(
    '/upload',
    authMiddleware,               
    uploadMiddleware,
    controller.uploadPurchaseOrder
);
// More specific routes should be placed before general routes
router.get(
    '/status/:id',
    authMiddleware,
    controller.getPurchaseOrderStatus
);
router.get(
    '/:id', 
    authMiddleware,
    controller.getPurchaseOrderById
);

module.exports = router;
