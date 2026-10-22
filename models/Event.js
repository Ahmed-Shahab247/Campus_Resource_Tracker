const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true, 
        trim: true 
    },
    description: { 
        type: String, 
        required: true, 
        trim: true 
    },
    scope: { 
        type: String, 
        enum: ['global', 'departmental'], 
        default: 'departmental' 
    },
    department: { 
        type: String, 
        required: true 
    }, // e.g. 'MCA', 'CSE' matched from resource course
    resource: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Resource', 
        required: true 
    },
    booking: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Booking', 
        required: true 
    },
    organizer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    date: { 
        type: Date, 
        required: true 
    },
    timeSlot: { 
        type: String, 
        required: true 
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Event', eventSchema);