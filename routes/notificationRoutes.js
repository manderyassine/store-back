const express = require('express');
const router = express.Router();
const { 
    getNotifications, 
    markNotificationAsRead, 
    clearAllNotifications 
} = require('../controllers/notificationController');
const { 
    protect, 
    restrictTo 
} = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Get all notifications for the logged-in user
router.get('/', 
    protect, 
    asyncHandler(getNotifications)
);

// Mark a specific notification as read
router.patch('/:id/read', 
    protect, 
    asyncHandler(markNotificationAsRead)
);

// Clear all notifications for the logged-in user
router.delete('/', 
    protect, 
    asyncHandler(clearAllNotifications)
);

module.exports = router;
