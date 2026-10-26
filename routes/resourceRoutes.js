// Purpose: Lists available campus resources and ensures the default campus resources exist.
const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');

// GET ALL RESOURCES (Ensures placeholder DSCE campus resources exist)
router.get('/', async (req, res) => {
    try {
        const defaultResources = [
            { building: "Block 1 - Heritage Block", course: "Central Administration", roomNumber: "Room 101", type: "meeting_room", capacity: 30 },
            { building: "Block 1 - Heritage Block", course: "Admissions Office", roomNumber: "Room 102", type: "meeting_room", capacity: 20 },
            { building: "Block 1 - Heritage Block", course: "Placement Cell", roomNumber: "Room 103", type: "meeting_room", capacity: 30 },
            { building: "Block 2", course: "Central Library and Information Centre", roomNumber: "Room 201", type: "classroom", capacity: 100 },
            { building: "Block 3", course: "Department of Automobile Engineering", roomNumber: "Room 301", type: "classroom", capacity: 60 },
            { building: "Block 3", course: "Department of Automobile Engineering", roomNumber: "Lab 302", type: "lab", capacity: 40 },
            { building: "Block 4", course: "Department of Aeronautical Engineering", roomNumber: "Room 401", type: "classroom", capacity: 60 },
            { building: "Block 4", course: "Department of Aeronautical Engineering", roomNumber: "Lab 402", type: "lab", capacity: 40 },
            { building: "Block 5", course: "Department of Mechanical Engineering (Main labs and classrooms)", roomNumber: "Room 501", type: "classroom", capacity: 60 },
            { building: "Block 5", course: "Department of Mechanical Engineering (Main labs and classrooms)", roomNumber: "Lab 502", type: "lab", capacity: 40 },
            { building: "Block 6 - New Mechanical Block", course: "Core heavy machinery labs", roomNumber: "Lab 601", type: "lab", capacity: 40 },
            { building: "Block 6 - New Mechanical Block", course: "Lathe workshops", roomNumber: "Workshop 602", type: "equipment", capacity: 30 },
            { building: "Block 6 - New Mechanical Block", course: "Turbines", roomNumber: "Lab 603", type: "lab", capacity: 30 },
            { building: "Block 7", course: "Department of Electrical & Electronics Engineering (EEE)", roomNumber: "Room 701", type: "classroom", capacity: 60 },
            { building: "Block 7", course: "Department of Electrical & Electronics Engineering (EEE)", roomNumber: "Lab 702", type: "lab", capacity: 40 },
            { building: "Block 8", course: "Department of Industrial Engineering & Management (IEM)", roomNumber: "Room 801", type: "classroom", capacity: 60 },
            { building: "Block 9", course: "Department of Chemistry (General Engineering Sciences)", roomNumber: "Room 901", type: "classroom", capacity: 60 },
            { building: "Block 9", course: "Department of Chemistry (General Engineering Sciences)", roomNumber: "Lab 902", type: "lab", capacity: 40 },
            { building: "Block 10", course: "Department of Biotechnology", roomNumber: "Room 1001", type: "classroom", capacity: 60 },
            { building: "Block 10", course: "Department of Biotechnology", roomNumber: "Lab 1002", type: "lab", capacity: 40 },
            { building: "Block 12", course: "Dayananda Sagar Pre-University College (DSPC)", roomNumber: "Room 1201", type: "classroom", capacity: 60 },
            { building: "Block 13", course: "School of Arts, Science, and Commerce", roomNumber: "Room 1301", type: "classroom", capacity: 60 },
            { building: "Block 14", course: "Department of Architecture", roomNumber: "Room 1401", type: "classroom", capacity: 60 },
            { building: "Block 14", course: "Department of Architecture", roomNumber: "Studio 1402", type: "lab", capacity: 40 },
            { building: "Block 16", course: "MBA", roomNumber: "Room 1601", type: "classroom", capacity: 60 },
            { building: "Block 17", course: "MCA", roomNumber: "Room 1701", type: "classroom", capacity: 60 },
            { building: "Block 17", course: "MCA", roomNumber: "Lab 1702", type: "lab", capacity: 40 }
        ];

        await Resource.bulkWrite(defaultResources.map(resource => ({
            updateOne: {
                filter: {
                    building: resource.building,
                    course: resource.course,
                    roomNumber: resource.roomNumber
                },
                update: { $setOnInsert: resource },
                upsert: true
            }
        })));
        const resources = await Resource.find({ isAvailable: true });

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