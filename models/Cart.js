const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be at least 1'],
            max: [100, 'Quantity cannot exceed 100']
        },
        price: {
            type: Number,
            required: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for total cart value
CartSchema.virtual('total').get(function() {
    return this.items.reduce((total, item) => 
        total + (item.price * item.quantity), 0
    );
});

// Middleware to update timestamp
CartSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Populate product details
CartSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'items.product',
        select: 'name price image countInStock'
    });
    next();
});

const Cart = mongoose.model('Cart', CartSchema);

module.exports = Cart;
