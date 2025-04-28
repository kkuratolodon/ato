const express = require('express');
const router = express.Router();
const { controller } = require('../controllers/purchaseOrderController');
const authMiddleware = require('../middlewares/authMiddleware');
// const apiLimiter = require('../middlewares/rateLimitMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

router.post(
    '/upload',
    authMiddleware,               
    uploadMiddleware,
    controller.uploadPurchaseOrder
);
router.get(
    '/:id', 
    authMiddleware,
    controller.getPurchaseOrderById
);

module.exports = router;
