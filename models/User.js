const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true, 
        trim: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        enum: ['student', 'faculty'], 
        default: 'student',
        required: true 
    },
    department: {
        type: String,
        default: 'General',
        required: true
    },
    otp: { 
        type: String 
    },
    otpExpires: { 
        type: Date 
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('User', userSchema);