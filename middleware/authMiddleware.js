// Purpose: Verifies incoming JWTs and restricts routes by user role.
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const JWT_SECRET = require('../config/jwt');

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
        return;
    }

    if (!mongoose.isValidObjectId(decoded.userId)) {
        return res.status(401).json({ error: 'Account no longer exists. Please log in again.' });
    }

    try {
        const userExists = await User.exists({ _id: decoded.userId });
        if (!userExists) {
            return res.status(401).json({ error: 'Account no longer exists. Please log in again.' });
        }
        req.user = decoded; // Contains userId, email, role
        return next();
    } catch (err) {
        console.error('Error validating authenticated account:', err);
        return res.status(500).json({ error: 'Could not validate the account.' });
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access forbidden: Insufficient permissions.' });
        }
        next();
    };
};

module.exports = { verifyToken, authorizeRoles };