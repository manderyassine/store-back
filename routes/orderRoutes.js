const express = require('express');
const router = express.Router();
const { 
    addOrderItems, 
    getOrderById, 
    getMyOrders, 
    getOrders, 
    updateOrderToPaid, 
    updateOrderToDelivered,
    cancelOrder
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public Routes
router.route('/').post(protect, addOrderItems);

// User Routes
router.route('/myorders').get(protect, getMyOrders);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/pay').put(protect, updateOrderToPaid);
router.route('/:id/cancel').put(protect, cancelOrder);

// Admin Routes
router.route('/').get(protect, admin, getOrders);
router.route('/:id/deliver').put(protect, admin, updateOrderToDelivered);

module.exports = router;
