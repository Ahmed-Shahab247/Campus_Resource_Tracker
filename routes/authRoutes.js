// Purpose: Handles user registration, OTP verification, and login for students and faculty.
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken'); // Run `npm install jsonwebtoken` if not installed
const nodemailer = require('nodemailer');
const JWT_SECRET = require('../config/jwt');

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
        const cleanEmail = email.toLowerCase().trim();

        if (!cleanEmail.endsWith('@dsce.edu.in')) {
            return res.status(400).json({ 
                message: 'Registration restricted! You must use an official @dsce.edu.in email address.' 
            });
        }

        const emailLocalPart = cleanEmail.split('@')[0];
        const studentUsnRegex = /^1ds\d{2}[a-z]{2}\d{3}$/;

        let role = 'faculty';
        let department = 'General';

        if (studentUsnRegex.test(emailLocalPart)) {
            role = 'student';
            // Extract branch from USN (e.g., '1ds25mc006' -> 'mc' -> MCA)
            const branchCode = emailLocalPart.substring(5, 7).toUpperCase();
            if (branchCode === 'MC') department = 'MCA';
            else if (branchCode === 'CS') department = 'CSE';
            else if (branchCode === 'CV') department = 'Civil';
            else department = branchCode;
        } else {
            // Faculty detection based on keywords in email (e.g. mca.sharma@dsce.edu.in or hod.mba@dsce.edu.in)
            if (emailLocalPart.includes('mca')) department = 'MCA';
            else if (emailLocalPart.includes('mba')) department = 'MBA';
            else if (emailLocalPart.includes('bba')) department = 'BBA';
            else if (emailLocalPart.includes('cse')) department = 'CSE';
            else department = 'General'; // Can see general/admin resources
        }

        let user = await User.findOne({ email: cleanEmail });
        if (user && user.isVerified) {
            return res.status(400).json({ message: 'Email already registered and verified.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        if (!user) {
            user = new User({ name, email: cleanEmail, password, role, department, otp, otpExpires, isVerified: false });
        } else {
            user.name = name;
            user.password = password;
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

        // Direct password check (or use bcrypt.compare if you hashed passwords)
        if (user.password !== password) {
            return res.status(400).json({ message: 'Invalid email or password.' });
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