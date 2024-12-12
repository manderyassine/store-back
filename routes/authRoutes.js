const express = require('express');
const router = express.Router();
const { 
    registerUser, 
    loginUser, 
    getUserProfile, 
    updateUserProfile 
} = require('../controllers/authController');
const { 
    protect 
} = require('../middleware/authMiddleware');
const { 
    validateRequest,
    registerValidation,
    loginValidation,
    updateProfileValidation
} = require('../middleware/validationMiddleware');

// Public Routes
router.post('/register', 
    registerValidation,
    validateRequest, 
    registerUser
);
router.post('/login', 
    loginValidation,
    validateRequest, 
    loginUser
);

// Protected Routes
router.get('/profile', 
    protect, 
    getUserProfile
);
router.put('/profile', 
    protect,
    updateProfileValidation,
    validateRequest, 
    updateUserProfile
);

module.exports = router;
