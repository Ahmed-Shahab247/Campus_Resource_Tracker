require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'smart_campus_secret_key_123';

module.exports = JWT_SECRET;
