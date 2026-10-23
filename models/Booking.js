// Purpose: Defines booking records for room requests, statuses, and event metadata.
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    resource_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    purpose: { type: String, required: true },        // e.g., "Coding Club Weekly Meet"
    status: { 
        type: String, 
        enum: ['PENDING_FACULTY', 'PENDING_ADMIN', 'APPROVED', 'REJECTED', 'COMPLETED'], 
        default: 'PENDING_FACULTY' 
    },
    remarks: { type: String, default: '' },            // Faculty/Admin feedback notes
    isEvent: {
        type: Boolean,
        default: false
    },
    eventTitle: {
        type: String,
        trim: true
    },
    eventDescription: {
        type: String,
        trim: true
    },
    eventScope: {
        type: String,
        enum: ['global', 'departmental'],
        default: 'departmental'
    }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);