const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');

class WebSocketService {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3000',
                methods: ["GET", "POST"]
            }
        });

        // User socket mapping
        this.userSockets = new Map();

        this.initializeSocketEvents();
    }

    initializeSocketEvents() {
        this.io.use(this.authenticateSocket.bind(this));

        this.io.on('connection', (socket) => {
            console.log('New client connected:', socket.user._id);

            // Store user socket
            this.userSockets.set(socket.user._id.toString(), socket);

            // Join user-specific room
            socket.join(socket.user._id.toString());

            // Listen for ticket-related events
            this.setupTicketEvents(socket);

            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.user._id);
                this.userSockets.delete(socket.user._id.toString());
            });
        });
    }

    async authenticateSocket(socket, next) {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (!user) {
                return next(new Error('User not found'));
            }

            socket.user = user;
            next();
        } catch (error) {
            return next(new Error('Authentication error'));
        }
    }

    setupTicketEvents(socket) {
        // Listen for new ticket creation request
        socket.on('create_ticket', async (ticketData) => {
            try {
                const ticket = new Ticket({
                    ...ticketData,
                    user: socket.user._id
                });
                await ticket.save();

                // Broadcast to admin users
                const adminSockets = await this.getAdminSockets();
                adminSockets.forEach(adminSocket => {
                    adminSocket.emit('new_ticket', ticket);
                });
            } catch (error) {
                socket.emit('ticket_error', error.message);
            }
        });

        // Listen for ticket updates
        socket.on('update_ticket', async (ticketId, updateData) => {
            try {
                const ticket = await Ticket.findByIdAndUpdate(
                    ticketId, 
                    updateData, 
                    { new: true }
                );

                // Notify relevant users
                this.notifyTicketUpdate(ticket);
            } catch (error) {
                socket.emit('ticket_error', error.message);
            }
        });
    }

    async getAdminSockets() {
        const adminUsers = await User.find({ isAdmin: true });
        return adminUsers
            .map(admin => this.userSockets.get(admin._id.toString()))
            .filter(socket => socket !== undefined);
    }

    async notifyTicketUpdate(ticket) {
        // Notify ticket owner
        const ownerSocket = this.userSockets.get(ticket.user.toString());
        if (ownerSocket) {
            ownerSocket.emit('ticket_updated', ticket);
        }

        // Notify assigned staff if exists
        if (ticket.assignedStaff) {
            const staffSocket = this.userSockets.get(ticket.assignedStaff.toString());
            if (staffSocket) {
                staffSocket.emit('ticket_updated', ticket);
            }
        }

        // Notify admins
        const adminSockets = await this.getAdminSockets();
        adminSockets.forEach(adminSocket => {
            adminSocket.emit('ticket_updated', ticket);
        });
    }

    // Broadcast notifications
    broadcastNotification(userId, notification) {
        const userSocket = this.userSockets.get(userId.toString());
        if (userSocket) {
            userSocket.emit('new_notification', notification);
        }
    }

    // Get active connections
    getActiveConnections() {
        return Array.from(this.userSockets.keys());
    }
}

module.exports = WebSocketService;
