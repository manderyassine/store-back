const express = require('express');
const router = express.Router();
const { 
    getProducts, 
    getProductById, 
    createProduct, 
    updateProduct, 
    deleteProduct,
    createProductReview,
    searchProducts,
    advancedSearchProducts 
} = require('../controllers/productController');
const { 
    protect, 
    admin 
} = require('../middleware/authMiddleware');
const { 
    validateRequest,
    productValidation,
    reviewValidation 
} = require('../middleware/validationMiddleware');

// Public Routes
router.get('/', getProducts);
router.get('/:id', getProductById);

// Search Routes
router.get('/search', searchProducts);
router.get('/advanced-search', advancedSearchProducts);

// Protected Routes
router.post('/', 
    protect, 
    admin, 
    productValidation, 
    validateRequest, 
    createProduct
);

router.put('/:id', 
    protect, 
    admin, 
    productValidation, 
    validateRequest, 
    updateProduct
);

router.delete('/:id', 
    protect, 
    admin, 
    deleteProduct
);

router.post('/:id/reviews', 
    protect, 
    reviewValidation, 
    validateRequest, 
    createProductReview
);

module.exports = router;
