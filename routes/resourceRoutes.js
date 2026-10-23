// Purpose: Lists available campus resources and seeds default resource data when the collection is empty.
const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');

// GET ALL RESOURCES (Auto-seeds realistic DSCE campus data if empty)
router.get('/', async (req, res) => {
    try {
        let resources = await Resource.find({ isAvailable: true });
        
        if (resources.length === 0) {
            const defaultResources = [
                // Building 15 - PG & MCA Block
                { building: "Building 15", course: "MCA", roomNumber: "Room 601", type: "classroom", capacity: 60 },
                { building: "Building 15", course: "MCA", roomNumber: "Room 602", type: "classroom", capacity: 60 },
                { building: "Building 15", course: "MCA", roomNumber: "Room 603", type: "classroom", capacity: 60 },
                { building: "Building 15", course: "MCA", roomNumber: "Room 604", type: "lab", capacity: 40 },

                // Building 13 - MBA & Management Block
                { building: "Building 13", course: "MBA", roomNumber: "Room 301", type: "classroom", capacity: 60 },
                { building: "Building 13", course: "MBA", roomNumber: "Room 302", type: "auditorium", capacity: 150 },

                // Building 10 - CSE, AI & IT Block
                { building: "Building 10", course: "CSE", roomNumber: "Room 201", type: "ai lab", capacity: 50 },
                { building: "Building 10", course: "CSE", roomNumber: "Room 202", type: "lab", capacity: 60 },
                { building: "Building 10", course: "ISE", roomNumber: "Room 401", type: "classroom", capacity: 70 },

                // Science Block - BCA & Applied Sciences
                { building: "Science Block", course: "BCA", roomNumber: "Room 101", type: "computer lab", capacity: 60 },
                { building: "Science Block", course: "BCA", roomNumber: "Room 102", type: "classroom", capacity: 50 },

                // Engineering Blocks
                { building: "Mechanical Block", course: "Mechanical", roomNumber: "Workshop 1", type: "workshop", capacity: 90 },
                { building: "Civil Block", course: "Civil", roomNumber: "CAD Lab 2", type: "lab", capacity: 45 },
                { building: "ECE Block", course: "ECE", roomNumber: "VLSI Lab 1", type: "lab", capacity: 40 },

                // Heritage / Admin Block - General Institutional Events
                { building: "Heritage Block", course: "General", roomNumber: "Aryabhata Hall", type: "auditorium", capacity: 250 }
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