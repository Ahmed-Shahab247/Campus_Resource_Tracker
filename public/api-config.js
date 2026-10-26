const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
window.API_BASE_URL = isLocalHost ? '' : 'https://campus-resource-tracker.onrender.com';
window.apiUrl = path => `${window.API_BASE_URL}${path}`;
