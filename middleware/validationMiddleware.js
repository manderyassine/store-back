const { body, validationResult, param } = require('express-validator');

// Middleware to handle validation errors
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Validation rules for user registration
const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
        .not().matches(/^\d+$/).withMessage('Username cannot be only numbers'),
    
    body('email')
        .trim()
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must include uppercase, lowercase, number, and special character')
];

// Validation rules for user login
const loginValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required'),
    
    body('password')
        .notEmpty().withMessage('Password is required')
];

// Validation rules for profile update
const updateProfileValidation = [
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    
    body('password')
        .optional()
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must include uppercase, lowercase, number, and special character')
];

// Validation rules for product creation/update
const productValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Product name must be between 2 and 100 characters'),
    
    body('description')
        .trim()
        .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
    
    body('price')
        .isFloat({ min: 0 }).withMessage('Price must be a positive number')
        .toFloat(),
    
    body('category')
        .trim()
        .notEmpty().withMessage('Category is required'),
    
    body('stock')
        .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer')
        .toInt()
];

// Validation rules for order creation
const orderValidation = [
    body('products')
        .isArray({ min: 1 }).withMessage('At least one product is required'),
    
    body('products.*.product')
        .notEmpty().withMessage('Product ID is required'),
    
    body('products.*.quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be at least 1')
        .toInt(),
    
    body('totalPrice')
        .isFloat({ min: 0 }).withMessage('Total price must be a positive number')
        .toFloat(),
    
    body('shippingAddress.street')
        .trim()
        .notEmpty().withMessage('Street address is required'),
    
    body('shippingAddress.city')
        .trim()
        .notEmpty().withMessage('City is required'),
    
    body('shippingAddress.country')
        .trim()
        .notEmpty().withMessage('Country is required'),
    
    body('shippingAddress.postalCode')
        .trim()
        .notEmpty().withMessage('Postal code is required')
];

// Validation rules for product reviews
const reviewValidation = [
    body('rating')
        .isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
        .toFloat(),
    
    body('comment')
        .trim()
        .isLength({ min: 3, max: 500 }).withMessage('Comment must be between 3 and 500 characters')
];

// Validation rules for ticket creation
const ticketValidation = [
    body('order')
        .notEmpty().withMessage('Order ID is required')
        .isMongoId().withMessage('Invalid Order ID'),
    
    body('initialMessage')
        .optional()
        .trim()
        .isLength({ min: 3, max: 500 }).withMessage('Message must be between 3 and 500 characters')
];

// Validation rules for ticket messages
const messageValidation = [
    body('content')
        .trim()
        .isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters')
];

module.exports = {
    validateRequest,
    registerValidation,
    loginValidation,
    updateProfileValidation,
    productValidation,
    orderValidation,
    reviewValidation,
    ticketValidation,
    messageValidation
};
