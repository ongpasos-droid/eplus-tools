const db = require('../utils/db');
const uuid = require('../utils/uuid');

const User = {
  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT id, email, name, role, subscription, email_verified, created_at FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create({ email, passwordHash, name }) {
    const id = uuid();
    await db.query(
      'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
      [id, email, passwordHash, name]
    );
    return { id, email, name, role: 'user', subscription: 'free' };
  },
};

module.exports = User;
