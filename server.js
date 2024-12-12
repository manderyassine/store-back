const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const WebSocketService = require('./services/webSocketService');

const { 
    globalErrorHandler, 
    logger, 
    handleUnhandledRejections,
    handleUncaughtExceptions
} = require('./middleware/errorMiddleware');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Production-ready server configuration
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Secure CORS for production
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'https://your-frontend-app-name.onrender.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
console.log('CORS Configuration:', corsOptions);

app.use(cors(corsOptions));

// Middleware
app.use(express.json());

// Middleware for logging all incoming requests
app.use((req, res, next) => {
    console.log(`🔍 Incoming Request: ${req.method} ${req.path}`);
    console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    next();
});

// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        body: req.body,
        query: req.query,
        headers: req.headers
    });
    next();
});

// Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const cartRoutes = require('./routes/cartRoutes');

app.use('/api/users', (req, res, next) => {
    console.log(`👤 Users Route Request: ${req.method} ${req.path}`);
    next();
}, authRoutes);

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cart', cartRoutes);

// 404 Route Handler
app.use((req, res, next) => {
    const err = new Error(`Can't find ${req.originalUrl} on this server!`);
    err.status = 'fail';
    err.statusCode = 404;
    next(err);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Global error handler
app.use(globalErrorHandler);

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket Service
const webSocketService = new WebSocketService(server);

// Enhanced error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optional: Implement logging or crash reporting
});

process.on('uncaughtException', handleUncaughtExceptions);

// Start server
const serverInstance = server.listen(PORT, HOST, () => {
    console.log(` Server is running on http://${HOST}:${PORT}`);
    console.log(`Frontend URL configured as: ${process.env.FRONTEND_URL}`);
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Add error handling for server startup
serverInstance.on('error', (error) => {
    console.error('Server Startup Error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please kill the process using this port.`);
    }
    if (error.code === 'EACCES') {
        console.error(`No permission to listen on port ${PORT}. Try running with sudo/admin privileges.`);
    }
});

module.exports = { app, server, webSocketService };
