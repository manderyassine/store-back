const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const TicketSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
        default: 'Open'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    messages: [{
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        isAdmin: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    assignedStaff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    closedAt: {
        type: Date
    },
    paymentDetails: {
        d17: String,
        boustaRIB: String
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

// Add text search index
TicketSchema.index({ 
    'messages.message': 'text',
    'description': 'text',
    'subject': 'text'
});

// Virtual for ticket age
TicketSchema.virtual('age').get(function() {
    return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for ticket age in milliseconds
TicketSchema.virtual('ticketAge').get(function() {
    return this.createdAt ? (new Date() - this.createdAt) : null;
});

// Compound index for efficient querying
TicketSchema.index({ user: 1, status: 1, priority: 1, createdAt: -1 });

// Pre-save hook for automatic status management
TicketSchema.pre('save', function(next) {
    // Auto-close ticket if all messages are resolved
    if (this.messages.length > 0 && 
        this.messages.every(msg => msg.isAdmin) && 
        this.status !== 'Closed') {
        this.status = 'Closed';
        this.closedAt = new Date();
        this.metadata.resolutionTime = new Date();
    }

    // Escalate priority for urgent messages
    const urgentMessages = this.messages.filter(msg => 
        msg.message.toLowerCase().includes('urgent') || 
        msg.message.toLowerCase().includes('emergency')
    );

    if (urgentMessages.length > 0 && this.priority !== 'Urgent') {
        this.priority = 'Urgent';
    }

    next();
});

// Post-save hook for logging
TicketSchema.post('save', function(doc) {
    console.log(`Ticket ${doc._id} updated: ${doc.status}`);
});

// Plugin for pagination
TicketSchema.plugin(mongoosePaginate);

const Ticket = mongoose.model('Ticket', TicketSchema);

module.exports = Ticket;
