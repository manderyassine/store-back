const express = require('express');
const router = express.Router();
const { 
    syncCart, 
    getCart, 
    addToCart, 
    removeFromCart, 
    updateCartItemQuantity 
} = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

// Cart Routes
router.use(protect);  // All routes require authentication

router.post('/sync', syncCart);
router.get('/', getCart);
router.post('/add', addToCart);
router.delete('/remove/:productId', removeFromCart);
router.put('/update/:productId', updateCartItemQuantity);

module.exports = router;
