const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (userExists) {
            return res.status(400).json({ 
                message: 'User already exists' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            username,
            email,
            password: hashedPassword
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id)
            });
        } else {
            res.status(400).json({ 
                message: 'Invalid user data' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            message: 'Server error during registration',
            error: error.message 
        });
    }
};

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check for user
        const user = await User.findOne({ username });

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ 
                message: 'Invalid credentials' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            message: 'Server error during login',
            error: error.message 
        });
    }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ 
                message: 'User not found' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            message: 'Server error fetching profile',
            error: error.message 
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            // Update fields
            user.username = req.body.username || user.username;
            user.email = req.body.email || user.email;
            
            // Update password if provided
            if (req.body.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(req.body.password, salt);
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                token: generateToken(updatedUser._id)
            });
        } else {
            res.status(404).json({ 
                message: 'User not found' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            message: 'Server error updating profile',
            error: error.message 
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile
};
