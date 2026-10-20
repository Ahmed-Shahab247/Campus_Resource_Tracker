const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');

// GET ALL RESOURCES (Auto-seeds dummy data if empty)
router.get('/', async (req, res) => {
    try {
        let resources = await Resource.find({ isAvailable: true });
        
        if (resources.length === 0) {
            const defaultResources = [
                // Your requested primary data: Building 15 -> MCA -> Rooms 601-604
                { building: "Building 15", course: "MCA", roomNumber: "Room 601", type: "classroom", capacity: 60 },
                { building: "Building 15", course: "MCA", roomNumber: "Room 602", type: "classroom", capacity: 60 },
                { building: "Building 15", course: "MCA", roomNumber: "Room 603", type: "classroom", capacity: 60 },
                { building: "Building 15", course: "MCA", roomNumber: "Room 604", type: "lab", capacity: 40 },

                // Dummy Block 10 -> CSE
                { building: "Building 10", course: "CSE", roomNumber: "Room 201", type: "classroom", capacity: 60 },
                { building: "Building 10", course: "CSE", roomNumber: "Room 202", type: "lab", capacity: 35 },

                // Dummy Block Science Block -> BCA
                { building: "Science Block", course: "BCA", roomNumber: "Room 101", type: "classroom", capacity: 50 },
                { building: "Science Block", course: "BCA", roomNumber: "Room 102", type: "classroom", capacity: 50 },

                // Admin Block -> Events / General
                { building: "Admin Block", course: "General / Institutional", roomNumber: "Aryabhata Hall", type: "auditorium", capacity: 250 }
            ];
            await Resource.insertMany(defaultResources);
            resources = await Resource.find({ isAvailable: true });
        }

        return res.status(200).json(resources);
    } catch (err) {
        console.error('Error fetching resources:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

// POST A NEW RESOURCE
router.post('/', async (req, res) => {
    try {
        const { building, course, roomNumber, type, capacity } = req.body;

        if (!building || !course || !roomNumber) {
            return res.status(400).json({ message: 'Building, course, and roomNumber are required fields.' });
        }

        const newResource = new Resource({
            building,
            course,
            roomNumber,
            type: type || 'classroom',
            capacity: capacity || 60,
            isAvailable: true
        });

        await newResource.save();
        return res.status(201).json({ message: 'Resource created successfully!', resource: newResource });

    } catch (err) {
        console.error('Error creating resource:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;