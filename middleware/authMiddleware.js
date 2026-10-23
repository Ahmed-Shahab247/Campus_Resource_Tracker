// Purpose: Verifies incoming JWTs and restricts routes by user role.
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwt');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Contains userId, email, role
        next();
    } catch (err) {
        res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
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