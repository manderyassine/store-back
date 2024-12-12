const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const NotificationService = require('../services/notificationService');

// @desc    Create a new ticket
// @route   POST /api/tickets
// @access  Private
const createTicket = async (req, res) => {
    try {
        const { 
            order, 
            initialMessage 
        } = req.body;

        // Verify order exists and belongs to user
        const existingOrder = await Order.findById(order);
        if (!existingOrder || existingOrder.user.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Create ticket
        const ticket = new Ticket({
            order: existingOrder._id,
            user: req.user._id,
            status: 'Open',
            messages: [{
                sender: req.user._id,
                content: initialMessage || 'New ticket created'
            }],
            paymentDetails: {
                d17: '21572385',
                boustaRIB: '5359401743124212'
            }
        });

        const createdTicket = await ticket.save();

        // Send notifications
        await NotificationService.notifyTicketCreation(createdTicket);

        res.status(201).json(createdTicket);
    } catch (error) {
        res.status(400).json({ 
            message: 'Error creating ticket', 
            error: error.message 
        });
    }
};

// @desc    Get ticket by ID
// @route   GET /api/tickets/:id
// @access  Private
const getTicketById = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id)
            .populate('user', 'username email')
            .populate('order')
            .populate('messages.sender', 'username');

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Ensure user can only access their own ticket or admin can access all
        if (ticket.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized to view this ticket' });
        }

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching ticket', 
            error: error.message 
        });
    }
};

// @desc    Get all tickets for a user
// @route   GET /api/tickets/mytickets
// @access  Private
const getUserTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.user._id })
            .populate('order')
            .sort({ createdAt: -1 });

        res.json(tickets);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching tickets', 
            error: error.message 
        });
    }
};

// @desc    Get all tickets (admin)
// @route   GET /api/tickets
// @access  Private/Admin
const getAllTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({})
            .populate('user', 'username email')
            .populate('order')
            .populate('assignedStaff', 'username')
            .sort({ createdAt: -1 });

        res.json(tickets);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching tickets', 
            error: error.message 
        });
    }
};

// @desc    Add a message to a ticket
// @route   POST /api/tickets/:id/messages
// @access  Private
const addTicketMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Ensure user can only message their own ticket or admin can message
        if (ticket.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized to message this ticket' });
        }

        ticket.messages.push({
            sender: req.user._id,
            content
        });

        // Update ticket status if it was closed
        if (ticket.status === 'Closed') {
            ticket.status = 'In Progress';
        }

        const updatedTicket = await ticket.save();

        // Send notifications
        await NotificationService.notifyTicketUpdate(updatedTicket, req.user);

        res.json(updatedTicket);
    } catch (error) {
        res.status(400).json({ 
            message: 'Error adding message', 
            error: error.message 
        });
    }
};

// @desc    Update ticket status
// @route   PUT /api/tickets/:id/status
// @access  Private/Admin
const updateTicketStatus = async (req, res) => {
    try {
        const { status, assignedStaff } = req.body;
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Validate status
        const validStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid ticket status' });
        }

        // Update ticket
        ticket.status = status || ticket.status;
        
        // Assign staff if provided and user is admin
        if (assignedStaff && req.user.isAdmin) {
            const staffUser = await User.findById(assignedStaff);
            if (!staffUser) {
                return res.status(404).json({ message: 'Staff member not found' });
            }
            ticket.assignedStaff = assignedStaff;
        }

        const updatedTicket = await ticket.save();

        // Send notifications
        await NotificationService.notifyTicketStatusUpdate(updatedTicket, req.user);

        res.json(updatedTicket);
    } catch (error) {
        res.status(400).json({ 
            message: 'Error updating ticket', 
            error: error.message 
        });
    }
};

// @desc    Advanced ticket filtering and search
// @route   GET /api/tickets/filter
// @access  Private/Admin
const filterTickets = async (req, res) => {
    try {
        const { 
            status, 
            priority, 
            startDate, 
            endDate, 
            assignedStaff, 
            searchQuery,
            page = 1, 
            limit = 10 
        } = req.query;

        // Build filter object
        const filter = {};

        if (status && status !== 'All') {
            filter.status = status;
        }

        if (priority && priority !== 'All') {
            filter.priority = priority;
        }

        if (assignedStaff) {
            filter.assignedStaff = assignedStaff;
        }

        // Date range filtering
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Text search across multiple fields
        if (searchQuery) {
            filter.$or = [
                { 'messages.content': { $regex: searchQuery, $options: 'i' } },
                { 'order.orderNumber': { $regex: searchQuery, $options: 'i' } }
            ];
        }

        // Pagination
        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            populate: [
                { path: 'user', select: 'username email' },
                { path: 'order' },
                { path: 'assignedStaff', select: 'username' }
            ],
            sort: { createdAt: -1 }
        };

        const result = await Ticket.paginate(filter, options);

        res.json({
            tickets: result.docs,
            totalPages: result.totalPages,
            currentPage: result.page,
            totalTickets: result.totalDocs
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Error filtering tickets', 
            error: error.message 
        });
    }
};

// @desc    Get ticket analytics
// @route   GET /api/tickets/analytics
// @access  Private/Admin
const getTicketAnalytics = async (req, res) => {
    try {
        const analytics = await Ticket.aggregate([
            // Status distribution
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            },
            // Priority distribution
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            },
            // Average resolution time
            {
                $group: {
                    _id: null,
                    avgResolutionTime: { 
                        $avg: { 
                            $subtract: ['$closedAt', '$createdAt'] 
                        } 
                    }
                }
            },
            // Tickets per month
            {
                $group: {
                    _id: { 
                        $dateToString: { 
                            format: '%Y-%m', 
                            date: '$createdAt' 
                        } 
                    },
                    ticketCount: { $sum: 1 }
                }
            }
        ]);

        res.json(analytics);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error generating ticket analytics', 
            error: error.message 
        });
    }
};

// @desc    Escalate ticket automatically
// @route   PUT /api/tickets/:id/escalate
// @access  Private/Admin
const escalateTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Escalation logic
        const currentTime = new Date();
        const ticketAge = currentTime - ticket.createdAt;
        const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        if (ticketAge > twentyFourHours && ticket.status === 'Open') {
            ticket.priority = 'High';
            ticket.status = 'In Progress';
            
            // Automatically assign to senior support
            const seniorSupport = await User.findOne({ 
                role: 'Senior Support', 
                isActive: true 
            });

            if (seniorSupport) {
                ticket.assignedStaff = seniorSupport._id;
            }

            // Add escalation note
            ticket.messages.push({
                sender: null, // System message
                content: 'Ticket automatically escalated due to prolonged open status',
                isSystemMessage: true
            });
        }

        const escalatedTicket = await ticket.save();

        // Send notifications
        await NotificationService.notifyTicketEscalation(escalatedTicket);

        res.json(escalatedTicket);
    } catch (error) {
        res.status(400).json({ 
            message: 'Error escalating ticket', 
            error: error.message 
        });
    }
};

module.exports = {
    createTicket,
    getTicketById,
    getUserTickets,
    getAllTickets,
    addTicketMessage,
    updateTicketStatus,
    filterTickets,
    getTicketAnalytics,
    escalateTicket
};
