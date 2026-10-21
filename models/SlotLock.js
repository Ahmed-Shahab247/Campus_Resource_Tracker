const mongoose = require('mongoose');

const slotLockSchema = new mongoose.Schema({
    resource_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resource',
        required: true
    },
    date: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2}$/
    },
    slot: {
        type: String,
        required: true,
        enum: ['09:00 - 11:00', '11:00 - 13:00', '14:00 - 16:00', '16:00 - 18:00']
    },
    locked: {
        type: Boolean,
        required: true
    }
}, {
    timestamps: true
});

slotLockSchema.index({ resource_id: 1, date: 1, slot: 1 }, { unique: true });

module.exports = mongoose.model('SlotLock', slotLockSchema);
