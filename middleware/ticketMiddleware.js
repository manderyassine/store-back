const Ticket = require('../models/Ticket');
const User = require('../models/User');

// Middleware to check ticket ownership and permissions
exports.checkTicketAccess = async (req, res, next) => {
    try {
        const ticketId = req.params.id;
        const userId = req.user._id;
        const userRole = req.user.role;

        const ticket = await Ticket.findById(ticketId).populate('user');

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Admin can access all tickets
        if (userRole === 'admin') {
            req.ticket = ticket;
            return next();
        }

        // User can only access their own tickets
        if (ticket.user._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Unauthorized access to ticket' });
        }

        req.ticket = ticket;
        next();
    } catch (error) {
        res.status(500).json({ 
            message: 'Error checking ticket access', 
            error: error.message 
        });
    }
};

// Middleware to validate ticket creation
exports.validateTicketCreation = async (req, res, next) => {
    try {
        const { subject, description, priority } = req.body;
        const userId = req.user._id;

        // Check for recent ticket flood
        const recentTickets = await Ticket.countDocuments({
            user: userId,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (recentTickets >= 5) {
            return res.status(429).json({ 
                message: 'Too many tickets created. Please wait before creating another.' 
            });
        }

        // Validate ticket content
        if (subject.length < 5 || subject.length > 100) {
            return res.status(400).json({ 
                message: 'Subject must be between 5 and 100 characters' 
            });
        }

        if (description.length < 10 || description.length > 500) {
            return res.status(400).json({ 
                message: 'Description must be between 10 and 500 characters' 
            });
        }

        const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
        if (!validPriorities.includes(priority)) {
            return res.status(400).json({ 
                message: 'Invalid ticket priority' 
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ 
            message: 'Error validating ticket', 
            error: error.message 
        });
    }
};

// Middleware to rate limit ticket operations
exports.rateLimitTicketOperations = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const currentTime = new Date();

        // Check message sending rate
        const recentMessages = await Ticket.countDocuments({
            'messages.sender': userId,
            'messages.createdAt': { $gte: new Date(currentTime - 5 * 60 * 1000) }
        });

        if (recentMessages >= 10) {
            return res.status(429).json({ 
                message: 'Too many messages sent. Please wait before sending more.' 
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ 
            message: 'Error rate limiting ticket operations', 
            error: error.message 
        });
    }
};

// Middleware to auto-assign tickets
exports.autoAssignTicket = async (req, res, next) => {
    try {
        // Find available admin with least assigned tickets
        const availableAdmin = await User.aggregate([
            { $match: { role: 'admin' } },
            {
                $lookup: {
                    from: 'tickets',
                    localField: '_id',
                    foreignField: 'assignedTo',
                    as: 'assignedTickets'
                }
            },
            { $addFields: { ticketCount: { $size: '$assignedTickets' } } },
            { $sort: { ticketCount: 1 } },
            { $limit: 1 }
        ]);

        if (availableAdmin.length > 0) {
            req.body.assignedTo = availableAdmin[0]._id;
        }

        next();
    } catch (error) {
        res.status(500).json({ 
            message: 'Error auto-assigning ticket', 
            error: error.message 
        });
    }
};
