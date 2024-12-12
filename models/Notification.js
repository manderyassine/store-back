const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const NotificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Notification must belong to a user']
    },
    ticket: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        default: null
    },
    type: {
        type: String,
        enum: [
            'TICKET_CREATED', 
            'TICKET_UPDATED', 
            'TICKET_ASSIGNED', 
            'TICKET_ESCALATED', 
            'TICKET_CLOSED', 
            'MESSAGE_RECEIVED'
        ],
        required: [true, 'Notification type is required']
    },
    message: {
        type: String,
        required: [true, 'Notification message is required']
    },
    isRead: {
        type: Boolean,
        default: false
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add index for efficient querying
NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// Pagination plugin
NotificationSchema.plugin(mongoosePaginate);

// Static method to create notification
NotificationSchema.statics.createNotification = async function(data) {
    try {
        const notification = await this.create(data);
        return notification;
    } catch (error) {
        throw new Error(`Failed to create notification: ${error.message}`);
    }
};

// Virtual to check if notification is recent
NotificationSchema.virtual('isRecent').get(function() {
    const RECENT_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - this.createdAt < RECENT_THRESHOLD;
});

// Populate user and ticket references
NotificationSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'user',
        select: 'username email'
    }).populate({
        path: 'ticket',
        select: '_id title status'
    });
    next();
});

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;
