const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        default: 0
    },
    imageUrl: {
        type: String,
        default: ''
    },
    reviews: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rating: Number,
        comment: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
