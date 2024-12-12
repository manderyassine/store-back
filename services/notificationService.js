const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { server, webSocketService } = require('../server');

class NotificationService {
    constructor() {
        // Configure email transporter
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    // Create in-app notification with WebSocket broadcast
    async createInAppNotification(data) {
        try {
            const notification = await Notification.createNotification(data);
            
            // Broadcast via WebSocket
            webSocketService.broadcastNotification(data.user, notification);

            return notification;
        } catch (error) {
            console.error('Error creating in-app notification:', error);
            throw error;
        }
    }

    // Send email and in-app notification
    async sendNotification(user, ticket, type) {
        try {
            // Create in-app notification
            const notification = await this.createInAppNotification({
                user: user._id,
                ticket: ticket._id,
                type: type,
                message: this.getNotificationMessage(ticket, type)
            });

            // Send email
            await this.sendEmailNotification(user, ticket, type);

            return notification;
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    // Get notification message
    getNotificationMessage(ticket, type) {
        const messages = {
            'TICKET_CREATED': `Your ticket #${ticket._id} has been created successfully.`,
            'TICKET_UPDATED': `Your ticket #${ticket._id} has been updated.`,
            'TICKET_ASSIGNED': `Your ticket #${ticket._id} has been assigned to a support agent.`,
            'TICKET_ESCALATED': `Your ticket #${ticket._id} has been escalated for urgent attention.`,
            'TICKET_CLOSED': `Your ticket #${ticket._id} has been closed.`,
            'MESSAGE_RECEIVED': `You have a new message on ticket #${ticket._id}.`
        };
        return messages[type] || 'You have a ticket notification.';
    }

    // Existing email notification method
    async sendEmailNotification(user, ticket, type) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: this.getEmailSubject(type),
                html: this.getEmailTemplate(user, ticket, type)
            };

            await this.transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('Error sending email notification:', error);
        }
    }

    // Get email subject
    getEmailSubject(type) {
        const subjects = {
            'TICKET_CREATED': 'New Ticket Created',
            'TICKET_UPDATED': 'Ticket Update',
            'TICKET_ASSIGNED': 'Ticket Assigned',
            'TICKET_ESCALATED': 'Ticket Escalated',
            'TICKET_CLOSED': 'Ticket Closed',
            'MESSAGE_RECEIVED': 'New Message Received'
        };
        return subjects[type] || 'Ticket Notification';
    }

    // Email template
    getEmailTemplate(user, ticket, type) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Ticket Notification</h2>
                <p>Dear ${user.username},</p>
                <p>${this.getNotificationMessage(ticket, type)}</p>
                <a href="${process.env.FRONTEND_URL}/tickets/${ticket._id}">View Ticket</a>
            </div>
        `;
    }

    // Notification for ticket creation
    async notifyTicketCreation(ticket) {
        const user = await User.findById(ticket.user);
        
        // Send notification
        await this.sendNotification(user, ticket, 'TICKET_CREATED');
    }

    // Notification for ticket update
    async notifyTicketUpdate(ticket, updatedBy) {
        const user = await User.findById(ticket.user);
        
        // Send notification
        await this.sendNotification(user, ticket, 'TICKET_UPDATED');
    }
}

module.exports = new NotificationService();
