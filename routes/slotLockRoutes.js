// Purpose: Lets faculty lock or unlock room time slots for resource availability management.
const express = require('express');
const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const SlotLock = require('../models/SlotLock');
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();
const validSlots = ['09:00 - 11:00', '11:00 - 13:00', '14:00 - 16:00', '16:00 - 18:00'];

function isValidDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function isSlotLockExempt(resource, date) {
    if (resource.type?.toLowerCase().includes('auditorium')) return true;
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday === 0 || weekday === 6;
}

function getFacultyDepartment(facultyUser) {
    const department = facultyUser.department?.trim();
    if (department && department.toLowerCase() !== 'general') return department;

    const emailLocalPart = facultyUser.email.split('@')[0].toLowerCase();
    if (emailLocalPart.includes('mca')) return 'MCA';
    if (emailLocalPart.includes('mba')) return 'MBA';
    if (emailLocalPart.includes('bba')) return 'BBA';
    if (emailLocalPart.includes('cse')) return 'CSE';
    return null;
}

async function getAccessibleResource(resourceId, user, res) {
    if (!mongoose.isValidObjectId(resourceId)) {
        res.status(400).json({ message: 'A valid resource_id is required.' });
        return null;
    }

    const resource = await Resource.findById(resourceId);
    if (!resource || !resource.isAvailable) {
        res.status(404).json({ message: 'Resource not found or unavailable.' });
        return null;
    }

    const role = user.role?.toLowerCase();
    if (role === 'faculty') {
        const facultyUser = await User.findById(user.userId);
        if (!facultyUser) {
            res.status(404).json({ message: 'Faculty user not found.' });
            return null;
        }

        const department = getFacultyDepartment(facultyUser);
        if (!department) {
            res.status(403).json({ message: 'No department is assigned to this faculty account.' });
            return null;
        }

        if (resource.course.trim().toLowerCase() !== department.toLowerCase()) {
            res.status(403).json({ message: 'You can only manage slot locks for your own department.' });
            return null;
        }
    } else if (role !== 'student') {
        res.status(403).json({ message: 'Access denied.' });
        return null;
    }

    return resource;
}

router.get('/', verifyToken, async (req, res) => {
    try {
        const { resource_id: resourceId, date } = req.query;
        if (!isValidDate(date)) {
            return res.status(400).json({ message: 'A valid date in YYYY-MM-DD format is required.' });
        }

        const resource = await getAccessibleResource(resourceId, req.user, res);
        if (!resource) return;

        const locks = await SlotLock.find({ resource_id: resource._id, date }).select('slot locked -_id');
        return res.status(200).json(locks);
    } catch (err) {
        console.error('Error fetching slot locks:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

router.put('/', verifyToken, async (req, res) => {
    try {
        if (req.user.role?.toLowerCase() !== 'faculty') {
            return res.status(403).json({ message: 'Access denied. Faculty only.' });
        }

        const { resource_id: resourceId, date, slot, locked } = req.body;
        if (!isValidDate(date)) {
            return res.status(400).json({ message: 'A valid date in YYYY-MM-DD format is required.' });
        }
        if (!validSlots.includes(slot)) {
            return res.status(400).json({ message: 'A valid slot is required.' });
        }
        if (typeof locked !== 'boolean') {
            return res.status(400).json({ message: 'locked must be a boolean.' });
        }

        const resource = await getAccessibleResource(resourceId, req.user, res);
        if (!resource) return;
        if (locked && isSlotLockExempt(resource, date)) {
            return res.status(400).json({
                message: 'Weekend and auditorium slots cannot be locked.'
            });
        }

        const lock = await SlotLock.findOneAndUpdate(
            { resource_id: resource._id, date, slot },
            { $set: { locked } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

        return res.status(200).json({ message: 'Slot updated successfully.', slotLock: lock });
    } catch (err) {
        console.error('Error updating slot lock:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;
