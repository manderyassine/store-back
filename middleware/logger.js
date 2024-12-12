const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

// Tell winston about the colors
winston.addColors(colors);

// Create a custom format with timestamp and colorization
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

// Define log transports
const transports = [
    // Console transport
    new winston.transports.Console(),
    
    // File transport for errors
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/error.log'),
        level: 'error',
        handleExceptions: true,
    }),
    
    // File transport for all logs
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/combined.log'),
        handleExceptions: true,
    }),
];

// Create the logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    levels,
    format,
    transports,
    exitOnError: false, // Do not exit on handled exceptions
});

module.exports = logger;
