const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorMiddleware');

// Get all notifications for the logged-in user
exports.getNotifications = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ 
            user: req.user._id 
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const totalNotifications = await Notification.countDocuments({ 
            user: req.user._id 
        });

        const unreadCount = await Notification.countDocuments({ 
            user: req.user._id, 
            read: false 
        });

        res.status(200).json({
            status: 'success',
            results: notifications.length,
            totalNotifications,
            unreadCount,
            notifications
        });
    } catch (error) {
        next(new AppError('Failed to retrieve notifications', 500));
    }
};

// Mark a specific notification as read
exports.markNotificationAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { 
                _id: req.params.id, 
                user: req.user._id 
            }, 
            { read: true }, 
            { new: true }
        );

        if (!notification) {
            return next(new AppError('No notification found with that ID', 404));
        }

        res.status(200).json({
            status: 'success',
            notification
        });
    } catch (error) {
        next(new AppError('Failed to mark notification as read', 500));
    }
};

// Clear all notifications for the logged-in user
exports.clearAllNotifications = async (req, res, next) => {
    try {
        await Notification.deleteMany({ user: req.user._id });

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (error) {
        next(new AppError('Failed to clear notifications', 500));
    }
};
