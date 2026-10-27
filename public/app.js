// Purpose: Handles login, registration, OTP verification, and role-based frontend navigation.
const API_BASE = `${window.API_BASE_URL}/api`;

// UI Navigation Switcher
function showSection(section) {
    document.getElementById('register-section').classList.add('hidden');
    document.getElementById('verify-section').classList.add('hidden');
    document.getElementById('login-section').classList.add('hidden');

    if (section === 'register') {
        document.getElementById('register-section').classList.remove('hidden');
    } else if (section === 'verify') {
        document.getElementById('verify-section').classList.remove('hidden');
    } else if (section === 'login') {
        document.getElementById('login-section').classList.remove('hidden');
    }
}

// Notification Helper
function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('alert-box');
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.classList.remove('hidden');
    setTimeout(() => alertBox.classList.add('hidden'), 4000);
}

// 1. Handle Registration (Automatically classifies role based on USN format)
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const [emailLocalPart, emailDomain, ...extraEmailParts] = email.toLowerCase().split('@');
    const isStudentEmail = emailDomain === 'dsce.edu.in' &&
        /^1ds\d{2}[a-z]{2}\d{3}$/.test(emailLocalPart);
    const isFacultyEmail = emailDomain === 'dayanandasagar.edu' &&
        /^[^+]+[+][a-z0-9-]+[+]vtu$/.test(emailLocalPart);
    if (extraEmailParts.length || (!isStudentEmail && !isFacultyEmail)) {
        showAlert('Use a student @dsce.edu.in USN email or a faculty name+course+vtu@dayanandasagar.edu email.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            showAlert(data.message || 'Registration initiated! Check your email for the OTP.', 'success');
            // Auto-fill verification email & transition view
            document.getElementById('verify-email').value = email;
            showSection('verify');
        } else {
            showAlert(data.message || 'Registration failed.');
        }
    } catch (err) {
        showAlert('Server connection error.');
    }
});

// 2. Handle OTP Verification
document.getElementById('verify-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('verify-email').value.trim();
    const otp = document.getElementById('verify-otp').value.trim();

    try {
        const res = await fetch(`${API_BASE}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();

        if (res.ok) {
            showAlert('Account verified successfully! You can now log in.', 'success');
            showSection('login');
        } else {
            showAlert(data.message || 'Verification failed. Invalid or expired OTP.');
        }
    } catch (err) {
        showAlert('Server connection error.');
    }
});

// 3. Handle Login & Role-Based Dashboard Routing
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('role', data.role); // 'student' or 'faculty'
            sessionStorage.setItem('userEmail', email);

            // Redirect based on institutional role
            if (data.role === 'faculty') {
                window.location.href = './faculty-dashboard.html';
            } else {
                window.location.href = './student-dashboard.html';
            }
        } else {
            showAlert(data.message || 'Invalid login credentials or unverified account.');
        }
    } catch (err) {
        showAlert('Server connection error.');
    }
});