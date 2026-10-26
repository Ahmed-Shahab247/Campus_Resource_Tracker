// Purpose: Handles user registration, OTP verification, and login for students and faculty.
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const JWT_SECRET = require('../config/jwt');
const { verifyToken } = require('../middleware/authMiddleware');
const STUDENT_EMAIL_DOMAIN = 'dsce.edu.in';
const FACULTY_EMAIL_DOMAIN = 'dayanandasagar.edu';
const FACULTY_DEPARTMENTS = {
    mca: 'MCA',
    mba: 'MBA',
    bba: 'BBA',
    cse: 'CSE',
    cv: 'Civil',
    eee: 'Department of Electrical & Electronics Engineering (EEE)',
    iem: 'Department of Industrial Engineering & Management (IEM)',
    automobile: 'Department of Automobile Engineering',
    aeronautical: 'Department of Aeronautical Engineering',
    mechanical: 'Department of Mechanical Engineering (Main labs and classrooms)',
    chemistry: 'Department of Chemistry (General Engineering Sciences)',
    biotechnology: 'Department of Biotechnology',
    architecture: 'Department of Architecture'
};

async function passwordMatches(user, password) {
    if (typeof password !== 'string' || typeof user.password !== 'string') return false;
    if (/^\$2[aby]\$/.test(user.password)) {
        return bcrypt.compare(password, user.password);
    }
    return user.password === password;
}

function createEmailTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 587);

    if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass }
    });
}

router.post('/register', async (req, res) => {
    try {
        const transporter = createEmailTransporter();
        if (!transporter) {
            return res.status(503).json({
                message: 'Email delivery is not configured. Set valid SMTP settings on the server.'
            });
        }

        const { name, email, password } = req.body;
        if (typeof name !== 'string' || !name.trim() || typeof password !== 'string' || !password) {
            return res.status(400).json({ message: 'Name and password are required.' });
        }
        if (typeof email !== 'string') {
            return res.status(400).json({ message: 'A valid institutional email address is required.' });
        }
        const cleanEmail = email.toLowerCase().trim();
        const [emailLocalPart, emailDomain, extraEmailPart] = cleanEmail.split('@');
        if (!emailLocalPart || extraEmailPart !== undefined) {
            return res.status(400).json({ message: 'A valid institutional email address is required.' });
        }

        const studentUsnRegex = /^1ds\d{2}[a-z]{2}\d{3}$/;
        let role;
        let department;

        if (emailDomain === STUDENT_EMAIL_DOMAIN && studentUsnRegex.test(emailLocalPart)) {
            role = 'student';
            // Extract branch from USN (e.g., '1ds25mc006' -> 'mc' -> MCA)
            const branchCode = emailLocalPart.substring(5, 7).toUpperCase();
            if (branchCode === 'MC') department = 'MCA';
            else if (branchCode === 'CS') department = 'CSE';
            else if (branchCode === 'CV') department = 'Civil';
            else department = branchCode;
        } else if (emailDomain === FACULTY_EMAIL_DOMAIN) {
            const facultyEmailMatch = emailLocalPart.match(/^([^+]+)\+([a-z0-9-]+)\+vtu$/);
            if (!facultyEmailMatch) {
                return res.status(400).json({
                    message: 'Faculty email must follow the name+course+vtu@dayanandasagar.edu format.'
                });
            }
            role = 'faculty';
            const courseCode = facultyEmailMatch[2];
            department = FACULTY_DEPARTMENTS[courseCode] || courseCode.toUpperCase();
        } else {
            return res.status(400).json({
                message: 'Use a valid student @dsce.edu.in USN email or faculty name+course+vtu@dayanandasagar.edu email.'
            });
        }

        let user = await User.findOne({ email: cleanEmail });
        if (user && user.isVerified) {
            return res.status(400).json({ message: 'Email already registered and verified.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        const passwordHash = await bcrypt.hash(password, 12);

        if (!user) {
            user = new User({ name, email: cleanEmail, password: passwordHash, role, department, otp, otpExpires, isVerified: false });
        } else {
            user.name = name.trim();
            user.password = passwordHash;
            user.otp = otp;
            user.otpExpires = otpExpires;
            user.role = role;
            user.department = department;
        }

        await user.save();

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.SMTP_USER,
                to: cleanEmail,
                subject: 'Your Smart Campus RMS verification code',
                text: `Your Smart Campus RMS verification code is ${otp}. It expires in 10 minutes.`,
                html: `<p>Your Smart Campus RMS verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code expires in 10 minutes.</p>`
            });
        } catch (err) {
            console.error('OTP email delivery error:', err);
            return res.status(502).json({
                message: 'Could not send the verification email. Please try registering again.'
            });
        }

        return res.status(200).json({ 
            message: `Verification code sent to your email. Role: ${role} (${department}).`
        });

    } catch (err) {
        console.error('Registration Error:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
            return res.status(400).json({ message: 'Current password and new password are required.' });
        }
        if (newPassword.length < 8 || newPassword.length > 128) {
            return res.status(400).json({ message: 'New password must be between 8 and 128 characters.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user || !user.isVerified) {
            return res.status(404).json({ message: 'Verified account not found.' });
        }
        if (!(await passwordMatches(user, currentPassword))) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }
        if (await passwordMatches(user, newPassword)) {
            return res.status(400).json({ message: 'New password must differ from your current password.' });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();
        return res.status(200).json({ message: 'Password changed successfully.' });
    } catch (err) {
        console.error('Password change error:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

router.post('/delete-account', verifyToken, async (req, res) => {
    try {
        const { currentPassword } = req.body;
        if (typeof currentPassword !== 'string' || !currentPassword) {
            return res.status(400).json({ message: 'Current password is required to delete your account.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user || !(await passwordMatches(user, currentPassword))) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        const bookings = await Booking.find({ user_id: user._id }).select('_id');
        const bookingIds = bookings.map(booking => booking._id);
        await Event.deleteMany({
            $or: [
                { organizer: user._id },
                { booking: { $in: bookingIds } }
            ]
        });
        await Booking.deleteMany({ user_id: user._id });
        await User.deleteOne({ _id: user._id });

        return res.status(200).json({ message: 'Account and associated bookings and events were deleted.' });
    } catch (err) {
        console.error('Account deletion error:', err);
        return res.status(500).json({ message: 'Could not delete the account. Please try again.' });
    }
});


// 2. VERIFY OTP ENDPOINT
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const cleanEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: cleanEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Account is already verified.' });
        }

        // Check if OTP matches and hasn't expired
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP code.' });
        }

        if (user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'OTP has expired. Please register again.' });
        }

        // Mark account as verified and clear OTP fields
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        return res.status(200).json({ message: 'Account verified successfully!' });

    } catch (err) {
        console.error('Verification Error:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});


// 3. LOGIN ENDPOINT
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: cleanEmail });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        if (!user.isVerified) {
            return res.status(403).json({ message: 'Please verify your account with OTP before logging in.' });
        }

        if (!(await passwordMatches(user, password))) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        if (!/^\$2[aby]\$/.test(user.password)) {
            user.password = await bcrypt.hash(password, 12);
            await user.save();
        }

        // Generate JWT Token
        const token = jwt.sign(
            { userId: user._id.toString(), role: user.role, email: user.email },
            JWT_SECRET, 
            { expiresIn: '1d' }
        );

        return res.status(200).json({
            message: 'Login successful',
            token,
            role: user.role
        });

    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;