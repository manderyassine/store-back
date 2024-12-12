const express = require('express');
const router = express.Router();
const { 
    createTicket, 
    getTicketById, 
    getUserTickets, 
    getAllTickets,
    updateTicketStatus,
    addTicketMessage,
    filterTickets,
    getTicketAnalytics,
    escalateTicket
} = require('../controllers/ticketController');
const { 
    protect, 
    admin 
} = require('../middleware/authMiddleware');
const { 
    checkTicketAccess, 
    validateTicketCreation,
    rateLimitTicketOperations,
    autoAssignTicket
} = require('../middleware/ticketMiddleware');

// Create a new ticket
router.post(
    '/', 
    protect, 
    validateTicketCreation, 
    autoAssignTicket, 
    createTicket
);

// Get user's tickets
router.get('/my-tickets', protect, getUserTickets);

// Get all tickets (admin only)
router.get('/', protect, admin, getAllTickets);

// Get ticket by ID
router.get(
    '/:id', 
    protect, 
    checkTicketAccess, 
    getTicketById
);

// Update ticket status
router.patch(
    '/:id/status', 
    protect, 
    admin, 
    updateTicketStatus
);

// Add message to ticket
router.post(
    '/:id/messages', 
    protect, 
    checkTicketAccess, 
    rateLimitTicketOperations, 
    addTicketMessage
);

// Advanced ticket filtering
router.get('/filter', protect, admin, async (req, res) => {
    const { 
        status, 
        priority, 
        assignedTo, 
        startDate, 
        endDate 
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    
    if (startDate && endDate) {
        filter.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    // Implement pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const tickets = await Ticket.find(filter)
            .populate('user', 'name email')
            .populate('assignedTo', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Ticket.countDocuments(filter);

        res.json({
            tickets,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Error filtering tickets', 
            error: error.message 
        });
    }
});

// New ticket filtering
router.route('/filter')
    .get(protect, admin, filterTickets);

// Ticket analytics
router.route('/analytics')
    .get(protect, admin, getTicketAnalytics);

// Escalate ticket
router.route('/:id/escalate')
    .put(protect, admin, escalateTicket);

module.exports = router;
