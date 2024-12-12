const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const OrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderItems: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be at least 1']
        },
        image: {
            type: String,
            required: true
        }
    }],
    shippingAddress: {
        address: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        postalCode: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true
        }
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Credit Card', 'PayPal', 'Bank Transfer']
    },
    paymentResult: {
        id: String,
        status: String,
        update_time: String,
        email_address: String
    },
    taxPrice: {
        type: Number,
        required: true,
        default: 0.0
    },
    shippingPrice: {
        type: Number,
        required: true,
        default: 0.0
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0.0
    },
    isPaid: {
        type: Boolean,
        required: true,
        default: false
    },
    paidAt: Date,
    isDelivered: {
        type: Boolean,
        required: true,
        default: false
    },
    deliveredAt: Date,
    status: {
        type: String,
        enum: [
            'Pending', 
            'Processing', 
            'Shipped', 
            'Delivered', 
            'Cancelled', 
            'Refunded'
        ],
        default: 'Pending'
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Pagination plugin
OrderSchema.plugin(mongoosePaginate);

// Virtual for order subtotal
OrderSchema.virtual('subtotal').get(function() {
    return this.orderItems.reduce((total, item) => 
        total + (item.price * item.quantity), 0
    );
});

// Middleware to validate stock before order creation
OrderSchema.pre('save', async function(next) {
    if (this.isNew) {
        const Product = mongoose.model('Product');
        for (const item of this.orderItems) {
            const product = await Product.findById(item.product);
            if (!product) {
                return next(new Error(`Product ${item.product} not found`));
            }
            if (product.countInStock < item.quantity) {
                return next(new Error(`Insufficient stock for product ${product.name}`));
            }
            // Reduce product stock
            product.countInStock -= item.quantity;
            await product.save();
        }
    }
    next();
});

// Populate references
OrderSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'user',
        select: 'username email'
    }).populate({
        path: 'orderItems.product',
        select: 'name price'
    });
    next();
});

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;
