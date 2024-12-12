const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, errors } = format;

// Custom error classes
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Create custom logger
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        printf(({ level, message, timestamp, stack }) => {
            return `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}`;
        })
    ),
    transports: [
        // Console transport
        new transports.Console(),
        
        // File transport for errors
        new transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // File transport for all logs
        new transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Middleware for handling async routes
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Global error handler middleware
const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log the error
    logger.error(`${err.status.toUpperCase()} - ${err.message}`, {
        method: req.method,
        path: req.path,
        body: req.body,
        user: req.user ? req.user.id : 'Unauthenticated',
        stack: err.stack
    });

    // Detailed error response for development
    const sendErrorDev = (err, res) => {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    };

    // Simplified error response for production
    const sendErrorProd = (err, res) => {
        // Operational, trusted error: send message to client
        if (err.isOperational) {
            res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        } 
        // Programming or unknown error: don't leak details
        else {
            console.error('UNHANDLED ERROR ', err);
            res.status(500).json({
                status: 'error',
                message: 'Something went very wrong!'
            });
        }
    };

    // Different error handling based on environment
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        // Handle Mongoose validation errors
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(el => el.message);
            const message = `Invalid input data. ${errors.join('. ')}`;
            err = new AppError(message, 400);
        }

        // Handle duplicate key errors
        if (err.code === 11000) {
            const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
            const message = `Duplicate field value: ${value}. Please use another value!`;
            err = new AppError(message, 400);
        }

        // Handle invalid JWT error
        if (err.name === 'JsonWebTokenError') {
            err = new AppError('Invalid token. Please log in again!', 401);
        }

        // Handle expired JWT error
        if (err.name === 'TokenExpiredError') {
            err = new AppError('Your token has expired! Please log in again.', 401);
        }

        sendErrorProd(err, res);
    }
};

// Unhandled promise rejection handler
const handleUnhandledRejections = (reason, promise) => {
    logger.error('UNHANDLED REJECTION!  Shutting down...');
    logger.error(`Reason: ${reason}`);
    
    // Log details about the unhandled rejection
    logger.error('Unhandled Promise Rejection:', {
        reason: reason,
        promise: promise
    });

    // Graceful shutdown
    process.exit(1);
};

// Uncaught exception handler
const handleUncaughtExceptions = (error) => {
    logger.error('UNCAUGHT EXCEPTION!  Shutting down...');
    logger.error(`Error: ${error.name}, Message: ${error.message}`);
    
    // Log full error details
    logger.error('Uncaught Exception Details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
    });

    // Graceful shutdown
    process.exit(1);
};

module.exports = {
    AppError,
    asyncHandler,
    globalErrorHandler,
    logger,
    handleUnhandledRejections,
    handleUncaughtExceptions
};
