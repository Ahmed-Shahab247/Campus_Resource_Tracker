// Purpose: Manages student booking requests, availability checks, and booking retrieval logic.
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Resource = require('../models/Resource');
const User = require('../models/User');
const Event = require('../models/Event');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'smart_campus_secret_key_123';
const CAMPUS_TIME_ZONE = 'Asia/Kolkata';

function getCampusDate(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: CAMPUS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

function getCampusTime(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: CAMPUS_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type).value;
    return {
        hour: Number(part('hour')),
        minute: Number(part('minute')),
        second: Number(part('second'))
    };
}

async function withResourceBookingLock(resourceId, callback) {
    const token = randomUUID();
    const timeoutAt = Date.now() + 5000;

    while (Date.now() < timeoutAt) {
        const resource = await Resource.findOneAndUpdate(
            {
                _id: resourceId,
                $or: [
                    { bookingLockExpiresAt: { $exists: false } },
                    { bookingLockExpiresAt: { $lte: new Date() } }
                ]
            },
            {
                $set: {
                    bookingLockToken: token,
                    bookingLockExpiresAt: new Date(Date.now() + 120000)
                }
            },
            { new: true }
        );

        if (resource) {
            try {
                return await callback(resource);
            } finally {
                await Resource.updateOne(
                    { _id: resourceId, bookingLockToken: token },
                    { $unset: { bookingLockToken: 1, bookingLockExpiresAt: 1 } }
                );
            }
        }

        await new Promise(resolve => setTimeout(resolve, 50));
    }

    const error = new Error('Timed out waiting for the resource booking lock.');
    error.code = 'BOOKING_LOCK_TIMEOUT';
    throw error;
}

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

// Return active bookings for the selected resource and day so the student UI
// can show requests and approved bookings made by other users.
router.get('/availability', verifyToken, async (req, res) => {
    try {
        const { resource_id: resourceId, date } = req.query;
        if (!mongoose.isValidObjectId(resourceId)) {
            return res.status(400).json({ message: 'A valid resource_id is required.' });
        }
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ message: 'A valid date in YYYY-MM-DD format is required.' });
        }

        const dayStart = new Date(`${date}T00:00:00.000Z`);
        if (!Number.isFinite(dayStart.getTime()) || dayStart.toISOString().slice(0, 10) !== date) {
            return res.status(400).json({ message: 'A valid date in YYYY-MM-DD format is required.' });
        }
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const bookings = await Booking.find({
            resource_id: resourceId,
            status: { $in: ['PENDING_FACULTY', 'PENDING_ADMIN', 'APPROVED'] },
            start_time: { $lt: dayEnd },
            end_time: { $gt: dayStart }
        }).select('start_time end_time status');

        return res.status(200).json(bookings);
    } catch (err) {
        console.error('Error checking booking availability:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

// 2. CREATE A NEW BOOKING REQUEST (Students Only)
router.post('/', verifyToken, async (req, res) => {
    try {
        if (req.user.role?.toLowerCase() !== 'student') {
            return res.status(403).json({ message: 'Only students can request bookings.' });
        }

        const {
            resource_id: resourceId,
            booking_date: requestedBookingDate,
            start_time: startTime,
            end_time: endTime,
            purpose,
            isEvent,
            eventTitle,
            eventDescription,
            eventScope
        } = req.body;

        if (!resourceId || !startTime || !endTime ||
            typeof purpose !== 'string' || !purpose.trim()) {
            return res.status(400).json({ message: 'All required booking fields must be provided.' });
        }

        if (!mongoose.isValidObjectId(resourceId)) {
            return res.status(400).json({ message: 'A valid resource is required.' });
        }

        const startTimeDate = new Date(startTime);
        const endTimeDate = new Date(endTime);
        if (!Number.isFinite(startTimeDate.getTime()) ||
            !Number.isFinite(endTimeDate.getTime()) ||
            startTimeDate >= endTimeDate) {
            return res.status(400).json({ message: 'A valid start time earlier than the end time is required.' });
        }
        const bookingDate = requestedBookingDate === undefined
            ? getCampusDate(startTimeDate)
            : requestedBookingDate;
        const parsedBookingDate = new Date(`${bookingDate}T00:00:00.000Z`);
        if (typeof bookingDate !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) ||
            !Number.isFinite(parsedBookingDate.getTime()) ||
            parsedBookingDate.toISOString().slice(0, 10) !== bookingDate) {
            return res.status(400).json({ message: 'A valid booking date is required.' });
        }
        const startCampusTime = getCampusTime(startTimeDate);
        const endCampusTime = getCampusTime(endTimeDate);
        if (getCampusDate(startTimeDate) !== bookingDate ||
            getCampusDate(endTimeDate) !== bookingDate ||
            startCampusTime.hour < 8 ||
            startCampusTime.hour >= 18 ||
            startCampusTime.minute !== 0 ||
            startCampusTime.second !== 0 ||
            endCampusTime.hour !== startCampusTime.hour + 1 ||
            endCampusTime.minute !== 0 ||
            endCampusTime.second !== 0 ||
            endTimeDate.getTime() - startTimeDate.getTime() !== 60 * 60 * 1000) {
            return res.status(400).json({
                message: 'Bookings must use one-hour slots between 8:00 AM and 6:00 PM campus time.'
            });
        }
        if (bookingDate <= getCampusDate(new Date())) {
            return res.status(400).json({ message: 'Bookings can only be requested for a future date.' });
        }

        if (isEvent && (
            typeof eventTitle !== 'string' || !eventTitle.trim() ||
            typeof eventDescription !== 'string' || !eventDescription.trim()
        )) {
            return res.status(400).json({ message: 'Event title and description are required when registering as an event.' });
        }

        const resource = await Resource.findById(resourceId);
        if (!resource || !resource.isAvailable) {
            return res.status(404).json({ message: 'Resource not found or unavailable.' });
        }

        const result = await withResourceBookingLock(resourceId, async lockedResource => {
            if (!lockedResource.isAvailable) {
                return { status: 404, body: { message: 'Resource not found or unavailable.' } };
            }

            const overlappingBooking = await Booking.findOne({
                resource_id: resourceId,
                status: { $in: ['PENDING_FACULTY', 'PENDING_ADMIN', 'APPROVED'] },
                start_time: { $lt: endTimeDate },
                end_time: { $gt: startTimeDate }
            });
            if (overlappingBooking) {
                return {
                    status: 409,
                    body: { message: 'This resource already has a pending or approved booking during that time.' }
                };
            }

            const newBooking = new Booking({
                user_id: req.user.userId,
                resource_id: resourceId,
                start_time: startTimeDate,
                end_time: endTimeDate,
                purpose: purpose.trim(),
                status: 'PENDING_FACULTY',
                isEvent: !!isEvent,
                eventTitle: isEvent ? eventTitle.trim() : '',
                eventDescription: isEvent ? eventDescription.trim() : '',
                eventScope: eventScope || 'departmental'
            });

            await newBooking.save();
            return {
                status: 201,
                body: { message: 'Booking request submitted successfully!', booking: newBooking }
            };
        });

        return res.status(result.status).json(result.body);

    } catch (err) {
        if (err.code === 'BOOKING_LOCK_TIMEOUT') {
            return res.status(503).json({ message: 'This room is processing another booking. Please try again.' });
        }
        console.error('Error creating booking:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

// 3. GET BOOKINGS FOR FACULTY (Filtered by Department)
router.get('/faculty-bookings', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'faculty') {
            return res.status(403).json({ message: 'Access denied. Faculty only.' });
        }

        const facultyUser = await User.findById(req.user.userId);
        if (!facultyUser) return res.status(404).json({ message: 'Faculty user not found.' });

        const bookings = await Booking.find()
            .populate('resource_id')
            .populate('user_id', 'name email role department')
            .sort({ createdAt: -1 });

        const filteredBookings = bookings.filter(b => {
            if (!b.resource_id) return false;
            if (facultyUser.department === 'General') return true;
            return b.resource_id.course.toLowerCase() === facultyUser.department.toLowerCase();
        });

        return res.status(200).json({
            department: facultyUser.department,
            bookings: filteredBookings
        });

    } catch (err) {
        console.error('Error fetching faculty bookings:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

// 4. UPDATE BOOKING STATUS (Approve / Reject) & Auto-Publish Event
router.patch('/:id/status', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'faculty') {
            return res.status(403).json({ message: 'Access denied. Faculty only.' });
        }

        const status = typeof req.body.status === 'string' ? req.body.status.toUpperCase() : '';
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const facultyUser = await User.findById(req.user.userId);
        if (!facultyUser) return res.status(404).json({ message: 'Faculty user not found.' });
        const currentBooking = await Booking.findById(req.params.id);
        if (!currentBooking) return res.status(404).json({ message: 'Booking not found.' });

        const result = await withResourceBookingLock(currentBooking.resource_id, async () => {
            const booking = await Booking.findById(req.params.id).populate('resource_id');
            if (!booking) {
                return { status: 404, body: { message: 'Booking not found.' } };
            }
            if (!booking.resource_id) {
                return { status: 404, body: { message: 'The resource for this booking no longer exists.' } };
            }
            if (facultyUser.department !== 'General' &&
                booking.resource_id.course.toLowerCase() !== facultyUser.department.toLowerCase()) {
                return { status: 403, body: { message: 'Access denied. Department mismatch.' } };
            }
            if (booking.status !== 'PENDING_FACULTY') {
                return { status: 400, body: { message: 'This booking request has already been processed.' } };
            }

            if (status === 'APPROVED') {
                const overlappingApprovedBooking = await Booking.findOne({
                    _id: { $ne: booking._id },
                    resource_id: booking.resource_id._id,
                    status: 'APPROVED',
                    start_time: { $lt: booking.end_time },
                    end_time: { $gt: booking.start_time }
                });
                if (overlappingApprovedBooking) {
                    return {
                        status: 409,
                        body: { message: 'This room already has an approved booking during that time.' }
                    };
                }
            }

            booking.status = status;
            await booking.save();

            if (status === 'APPROVED' && booking.isEvent) {
                const existingEvent = await Event.findOne({ booking: booking._id });
                if (!existingEvent) {
                    const start = booking.start_time.toISOString().slice(11, 16);
                    const end = booking.end_time.toISOString().slice(11, 16);
                    const newEvent = new Event({
                        title: booking.eventTitle,
                        description: booking.eventDescription,
                        scope: booking.eventScope,
                        department: booking.resource_id.course,
                        resource: booking.resource_id._id,
                        booking: booking._id,
                        organizer: booking.user_id,
                        date: booking.start_time,
                        timeSlot: `${start} - ${end}`
                    });
                    await newEvent.save();
                }
            } else if (status === 'REJECTED') {
                await Event.deleteOne({ booking: booking._id });
            }

            return {
                status: 200,
                body: { message: `Booking ${status.toLowerCase()} successfully!`, booking }
            };
        });

        return res.status(result.status).json(result.body);

    } catch (err) {
        if (err.code === 'BOOKING_LOCK_TIMEOUT') {
            return res.status(503).json({ message: 'This room is processing another booking. Please try again.' });
        }
        console.error('Error updating booking status:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;