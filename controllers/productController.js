const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    try {
        const { 
            search, 
            category, 
            minPrice, 
            maxPrice, 
            page = 1, 
            limit = 10 
        } = req.query;

        // Build query object
        let query = {};
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (category) {
            query.category = category;
        }
        
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        // Pagination
        const skip = (page - 1) * limit;

        const products = await Product.find(query)
            .skip(skip)
            .limit(Number(limit));

        const total = await Product.countDocuments(query);

        res.json({
            products,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalProducts: total
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching products', 
            error: error.message 
        });
    }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching product', 
            error: error.message 
        });
    }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            price, 
            category, 
            stock, 
            imageUrl 
        } = req.body;

        const product = new Product({
            name,
            description,
            price,
            category,
            stock,
            imageUrl: imageUrl || ''
        });

        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(400).json({ 
            message: 'Error creating product', 
            error: error.message 
        });
    }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            price, 
            category, 
            stock, 
            imageUrl 
        } = req.body;

        const product = await Product.findById(req.params.id);

        if (product) {
            product.name = name || product.name;
            product.description = description || product.description;
            product.price = price || product.price;
            product.category = category || product.category;
            product.stock = stock || product.stock;
            product.imageUrl = imageUrl || product.imageUrl;

            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(400).json({ 
            message: 'Error updating product', 
            error: error.message 
        });
    }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (product) {
            await product.deleteOne();
            res.json({ message: 'Product removed' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ 
            message: 'Error deleting product', 
            error: error.message 
        });
    }
};

// @desc    Add a review to a product
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;

        const product = await Product.findById(req.params.id);

        if (product) {
            const alreadyReviewed = product.reviews.find(
                r => r.user.toString() === req.user._id.toString()
            );

            if (alreadyReviewed) {
                return res.status(400).json({ 
                    message: 'Product already reviewed' 
                });
            }

            const review = {
                user: req.user._id,
                rating: Number(rating),
                comment
            };

            product.reviews.push(review);
            product.numReviews = product.reviews.length;
            product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) 
                / product.reviews.length;

            await product.save();
            res.status(201).json({ message: 'Review added' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(400).json({ 
            message: 'Error adding review', 
            error: error.message 
        });
    }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
const searchProducts = asyncHandler(async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ 
            message: 'Search query is required' 
        });
    }

    const searchRegex = new RegExp(query, 'i');
    const products = await Product.find({
        $or: [
            { name: searchRegex },
            { description: searchRegex },
            { category: searchRegex }
        ]
    })
    .limit(10)
    .select('name price image category');

    res.json({
        products,
        totalResults: products.length
    });
});

// @desc    Advanced search with filters
// @route   GET /api/products/advanced-search
// @access  Public
const advancedSearchProducts = asyncHandler(async (req, res) => {
    const { 
        query = '', 
        category = '', 
        minPrice = 0, 
        maxPrice = 1000, 
        page = 1, 
        limit = 12 
    } = req.query;

    const searchConditions = {};

    // Text search
    if (query) {
        const searchRegex = new RegExp(query, 'i');
        searchConditions.$or = [
            { name: searchRegex },
            { description: searchRegex }
        ];
    }

    // Category filter
    if (category) {
        searchConditions.category = category;
    }

    // Price range filter
    searchConditions.price = { 
        $gte: parseFloat(minPrice), 
        $lte: parseFloat(maxPrice) 
    };

    // Pagination
    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        select: 'name price image category rating numReviews'
    };

    const result = await Product.paginate(searchConditions, options);

    res.json({
        products: result.docs,
        totalResults: result.totalDocs,
        currentPage: result.page,
        totalPages: result.totalPages
    });
});

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    createProductReview,
    searchProducts,
    advancedSearchProducts
};
