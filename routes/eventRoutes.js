const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart_campus_secret_key_123';

// Auth Middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'Access denied. No token provided.' });

    const token = authHeader.split(' ')[1];
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

// GET APPROVED EVENTS (Filtered by Scope & Department)
router.get('/', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const events = await Event.find().populate('resource').populate('organizer', 'name email');

        // Scope filter: Global events shown to all; Departmental events shown to matching department or admin
        const visibleEvents = events.filter(e => {
            if (e.scope === 'global') return true;
            if (user.department === 'General') return true;
            return e.department.toLowerCase() === user.department.toLowerCase();
        });

        return res.status(200).json(visibleEvents);
    } catch (err) {
        console.error('Error fetching events:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;