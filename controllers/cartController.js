const asyncHandler = require('express-async-handler');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// @desc    Sync cart items
// @route   POST /api/cart/sync
// @access  Private
exports.syncCart = asyncHandler(async (req, res) => {
    const { cartItems } = req.body;

    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = new Cart({ 
                user: req.user._id, 
                items: [] 
            });
        }

        // Validate and update cart items
        const validatedItems = await Promise.all(cartItems.map(async (item) => {
            const product = await Product.findById(item.product);
            
            if (!product) {
                throw new Error(`Product ${item.product} not found`);
            }

            if (item.quantity > product.countInStock) {
                throw new Error(`Insufficient stock for product ${product.name}`);
            }

            return {
                product: product._id,
                quantity: item.quantity,
                price: product.price
            };
        }));

        cart.items = validatedItems;
        await cart.save();

        res.status(200).json({
            message: 'Cart synced successfully',
            cart: cart.items
        });
    } catch (error) {
        res.status(400).json({ 
            message: error.message 
        });
    }
});

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
exports.getCart = asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id })
        .populate('items.product', 'name price image countInStock');

    if (!cart) {
        return res.status(200).json({ items: [] });
    }

    res.status(200).json(cart.items);
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
exports.addToCart = asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }

    if (quantity > product.countInStock) {
        return res.status(400).json({ message: 'Insufficient stock' });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = new Cart({ 
            user: req.user._id, 
            items: [] 
        });
    }

    const existingItemIndex = cart.items.findIndex(
        item => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += quantity;
    } else {
        cart.items.push({ 
            product: productId, 
            quantity, 
            price: product.price 
        });
    }

    await cart.save();

    res.status(200).json({
        message: 'Item added to cart',
        cart: cart.items
    });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:productId
// @access  Private
exports.removeFromCart = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(
        item => item.product.toString() !== productId
    );

    await cart.save();

    res.status(200).json({
        message: 'Item removed from cart',
        cart: cart.items
    });
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/update/:productId
// @access  Private
exports.updateCartItemQuantity = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }

    if (quantity > product.countInStock) {
        return res.status(400).json({ message: 'Insufficient stock' });
    }

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(
        item => item.product.toString() === productId
    );

    if (itemIndex > -1) {
        cart.items[itemIndex].quantity = quantity;
        await cart.save();

        res.status(200).json({
            message: 'Cart item updated',
            cart: cart.items
        });
    } else {
        res.status(404).json({ message: 'Item not found in cart' });
    }
});
