const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    building: { 
        type: String, 
        required: true, 
        trim: true 
    },
    course: { 
        type: String, 
        required: true, 
        trim: true 
    },
    roomNumber: { 
        type: String, 
        required: true, 
        trim: true 
    },
    type: { 
        type: String, 
        enum: ['classroom', 'lab', 'auditorium', 'meeting_room', 'equipment'], 
        default: 'classroom' 
    },
    capacity: { 
        type: Number, 
        default: 60 
    },
    isAvailable: { 
        type: Boolean, 
        default: true 
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Resource', resourceSchema);