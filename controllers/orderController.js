const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Ticket = require('../models/Ticket');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
    const { 
        orderItems, 
        shippingAddress, 
        paymentMethod, 
        taxPrice, 
        shippingPrice, 
        totalPrice 
    } = req.body;

    // Validate order items
    if (!orderItems || orderItems.length === 0) {
        res.status(400);
        throw new Error('No order items');
    }

    // Validate and enrich order items
    const enrichedOrderItems = await Promise.all(orderItems.map(async (item) => {
        const product = await Product.findById(item.product);
        
        if (!product) {
            res.status(404);
            throw new Error(`Product ${item.product} not found`);
        }

        if (product.countInStock < item.quantity) {
            res.status(400);
            throw new Error(`Insufficient stock for product ${product.name}`);
        }

        return {
            product: product._id,
            name: product.name,
            price: product.price,
            quantity: item.quantity,
            image: product.image
        };
    }));

    // Create order
    const order = new Order({
        user: req.user._id,
        orderItems: enrichedOrderItems,
        shippingAddress,
        paymentMethod,
        taxPrice,
        shippingPrice,
        totalPrice
    });

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalPrice * 100), // Convert to cents
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: { 
            orderId: order._id.toString(),
            userId: req.user._id.toString()
        }
    });

    // Add payment intent to order
    order.paymentResult = {
        id: paymentIntent.id,
        status: paymentIntent.status
    };

    // Save order
    const createdOrder = await order.save();

    // Create support ticket for order tracking
    const ticket = new Ticket({
        user: req.user._id,
        subject: `Order #${createdOrder._id} Support`,
        description: `New order created. Order details: ${JSON.stringify(enrichedOrderItems)}`,
        status: 'Open',
        priority: 'Low'
    });
    await ticket.save();

    res.status(201).json({
        order: createdOrder,
        clientSecret: paymentIntent.client_secret
    });
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'username email');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Check order ownership or admin access
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to view this order');
    }

    res.json(order);
});

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50);  // Limit to last 50 orders

    res.json(orders);
});

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const options = {
        page,
        limit,
        sort: { createdAt: -1 },
        populate: {
            path: 'user',
            select: 'username email'
        }
    };

    const result = await Order.paginate({}, options);

    res.json({
        orders: result.docs,
        totalPages: result.totalPages,
        currentPage: result.page
    });
});

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(
        order.paymentResult.id
    );

    if (paymentIntent.status === 'succeeded') {
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentResult = {
            id: paymentIntent.id,
            status: paymentIntent.status,
            update_time: paymentIntent.created,
            email_address: paymentIntent.charges.data[0]?.billing_details?.email
        };

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } else {
        res.status(400);
        throw new Error('Payment not successful');
    }
});

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    order.isDelivered = true;
    order.deliveredAt = Date.now();
    order.status = 'Delivered';

    const updatedOrder = await order.save();
    res.json(updatedOrder);
});

// @desc    Cancel an order
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Only allow cancellation of pending or processing orders
    if (!['Pending', 'Processing'].includes(order.status)) {
        res.status(400);
        throw new Error('Order cannot be cancelled at this stage');
    }

    // Refund payment if already paid
    if (order.isPaid) {
        await stripe.refunds.create({
            payment_intent: order.paymentResult.id
        });
    }

    // Restore product stock
    for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
            $inc: { countInStock: item.quantity }
        });
    }

    order.status = 'Cancelled';
    order.isDelivered = false;

    const cancelledOrder = await order.save();
    res.json(cancelledOrder);
});

module.exports = {
    addOrderItems,
    getOrderById,
    getMyOrders,
    getOrders,
    updateOrderToPaid,
    updateOrderToDelivered,
    cancelOrder
};
