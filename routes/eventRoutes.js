// Purpose: Exposes event data filtered by department and visibility rules.
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');

function getCampusDate(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

// GET EVENTS (Filtered by Scope & Department)
router.get('/', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const events = await Event.find().populate('resource').populate('organizer', 'name email');

        const visibleEvents = events.filter(e => {
            if (e.scope === 'global') return true;
            return e.department.toLowerCase() === user.department.toLowerCase();
        });

        return res.status(200).json(visibleEvents);
    } catch (err) {
        console.error('Error fetching events:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

// FACULTY ANNOUNCEMENT (does not reserve a resource)
router.post('/', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'faculty') {
            return res.status(403).json({ message: 'Only faculty can post events.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user || user.role !== 'faculty') {
            return res.status(403).json({ message: 'Only faculty can post events.' });
        }

        const { title, description, scope, date, startTime, endTime } = req.body;
        if (typeof title !== 'string' || !title.trim() || title.trim().length > 160) {
            return res.status(400).json({ message: 'A title of 1 to 160 characters is required.' });
        }
        if (description !== undefined &&
            (typeof description !== 'string' || description.trim().length > 2000)) {
            return res.status(400).json({ message: 'Description must be 2000 characters or fewer.' });
        }
        if (!['global', 'departmental'].includes(scope)) {
            return res.status(400).json({ message: 'Scope must be global or departmental.' });
        }
        if (typeof date !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Number.isFinite(new Date(`${date}T00:00:00.000Z`).getTime()) ||
            new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
            return res.status(400).json({ message: 'A valid event date is required.' });
        }
        if (date < getCampusDate(new Date())) {
            return res.status(400).json({ message: 'Event date cannot be in the past.' });
        }

        const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
        if (!validTime(startTime) || !validTime(endTime) ||
            startTime >= endTime) {
            return res.status(400).json({ message: 'A valid start time earlier than the end time is required.' });
        }

        const event = new Event({
            title: title.trim(),
            description: description?.trim() || title.trim(),
            scope,
            department: user.department,
            organizer: user._id,
            date: new Date(`${date}T12:00:00.000Z`),
            timeSlot: `${startTime} - ${endTime}`
        });
        await event.save();

        return res.status(201).json({ message: 'Event posted successfully.', event });
    } catch (err) {
        console.error('Error posting event:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;