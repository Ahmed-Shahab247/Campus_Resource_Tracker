// Purpose: Exposes event data filtered by department and visibility rules.
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');

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