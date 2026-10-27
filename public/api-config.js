const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
window.API_BASE_URL = isLocalHost ? '' : 'https://campus-resource-tracker.onrender.com';
window.apiUrl = path => `${window.API_BASE_URL}${path}`;
window.sessionRole = () => {
    const token = sessionStorage.getItem('token');
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp * 1000 <= Date.now()) return null;
        if (!['student', 'faculty'].includes(payload.role)) return null;

        if (sessionStorage.getItem('role') !== payload.role) {
            sessionStorage.setItem('role', payload.role);
        }
        return payload.role;
    } catch (err) {
        return null;
    }
};
