const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Resource = require('../models/Resource');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart_campus_secret_key_123';

function getFacultyDepartment(facultyUser) {
    const department = facultyUser.department?.trim();
    if (department && department.toLowerCase() !== 'general') {
        return department;
    }

    const emailLocalPart = facultyUser.email.split('@')[0].toLowerCase();
    if (emailLocalPart.includes('mca')) return 'MCA';
    if (emailLocalPart.includes('mba')) return 'MBA';
    if (emailLocalPart.includes('bba')) return 'BBA';
    if (emailLocalPart.includes('cse')) return 'CSE';

    return null;
}

// Auth Middleware for Routes
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

// ==========================================
// STUDENT ENDPOINTS
// ==========================================

// 1. GET LOGGED-IN USER'S BOOKINGS
router.get('/my-bookings', verifyToken, async (req, res) => {
    try {
        const bookings = await Booking.find({ user_id: req.user.userId })
            .populate('resource_id')
            .sort({ createdAt: -1 });
        return res.status(200).json(bookings);
    } catch (err) {
        console.error('Error fetching student bookings:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

// 2. CREATE A NEW BOOKING REQUEST
router.post('/', verifyToken, async (req, res) => {
    try {
        const { resource_id, start_time, end_time, purpose } = req.body;

        if (!resource_id || !start_time || !end_time || !purpose?.trim()) {
            return res.status(400).json({
                message: 'Resource, start time, end time, and purpose are required.'
            });
        }

        const startTimeDate = new Date(start_time);
        const endTimeDate = new Date(end_time);

        if (!Number.isFinite(startTimeDate.getTime()) ||
            !Number.isFinite(endTimeDate.getTime()) ||
            startTimeDate >= endTimeDate) {
            return res.status(400).json({
                message: 'A valid start time earlier than the end time is required.'
            });
        }

        const resource = await Resource.findById(resource_id);
        if (!resource || !resource.isAvailable) {
            return res.status(404).json({ message: 'Resource not found or unavailable.' });
        }

        const overlappingBooking = await Booking.findOne({
            resource_id,
            status: { $in: ['PENDING_FACULTY', 'PENDING_ADMIN', 'APPROVED'] },
            start_time: { $lt: endTimeDate },
            end_time: { $gt: startTimeDate }
        });

        if (overlappingBooking) {
            return res.status(409).json({
                message: 'This resource already has a pending or approved booking during that time.'
            });
        }

        const newBooking = new Booking({
            user_id: req.user.userId,
            resource_id,
            start_time: startTimeDate,
            end_time: endTimeDate,
            purpose: purpose.trim(),
            status: req.user.role.toLowerCase() === 'faculty' ? 'APPROVED' : 'PENDING_FACULTY'
        });

        await newBooking.save();
        return res.status(201).json({ message: 'Booking request submitted successfully!', booking: newBooking });

    } catch (err) {
        console.error('Error creating booking:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

// ==========================================
// FACULTY ENDPOINTS (Department Filtered)
// ==========================================

// 3. GET BOOKINGS FOR FACULTY (Filtered by Department)
router.get('/faculty-bookings', verifyToken, async (req, res) => {
    try {
        if (req.user.role?.toLowerCase() !== 'faculty') {
            return res.status(403).json({ message: 'Access denied. Faculty only.' });
        }

        const facultyUser = await User.findById(req.user.userId);
        if (!facultyUser) {
            return res.status(404).json({ message: 'Faculty user not found.' });
        }

        const department = getFacultyDepartment(facultyUser);
        if (!department) {
            return res.status(403).json({ message: 'No department is assigned to this faculty account.' });
        }

        const departmentResources = await Resource.find({
            course: { $regex: `^${department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        }).select('_id');
        const bookings = await Booking.find({
            resource_id: { $in: departmentResources.map(resource => resource._id) }
        })
            .populate('resource_id')
            .populate('user_id', 'name email role department')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            department,
            bookings
        });

    } catch (err) {
        console.error('Error fetching faculty bookings:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

// 4. UPDATE BOOKING STATUS (Approve / Reject)
router.patch('/:id/status', verifyToken, async (req, res) => {
    try {
        if (req.user.role?.toLowerCase() !== 'faculty') {
            return res.status(403).json({ message: 'Access denied. Faculty only.' });
        }

        const status = typeof req.body.status === 'string' ? req.body.status.toUpperCase() : '';
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const booking = await Booking.findById(req.params.id).populate('resource_id');
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        const facultyUser = await User.findById(req.user.userId);
        if (!facultyUser) {
            return res.status(404).json({ message: 'Faculty user not found.' });
        }

        const department = getFacultyDepartment(facultyUser);
        if (!department) {
            return res.status(403).json({ message: 'No department is assigned to this faculty account.' });
        }

        if (!booking.resource_id ||
            booking.resource_id.course.trim().toLowerCase() !== department.toLowerCase()) {
            return res.status(403).json({ message: 'Access denied. You can only manage bookings for your own department.' });
        }

        if (booking.status !== 'PENDING_FACULTY') {
            return res.status(400).json({ message: 'This booking request has already been processed.' });
        }

        booking.status = status;
        await booking.save();

        return res.status(200).json({ message: `Booking ${status.toLowerCase()} successfully!`, booking });

    } catch (err) {
        console.error('Error updating booking status:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;