const db = require('../../utils/db');
const uuid = require('../../utils/uuid');

const User = {
  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.query(
      'SELECT id, email, name, role, subscription, email_verified, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  async create({ email, passwordHash, name }) {
    const id = uuid();
    await db.query(
      'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
      [id, email.toLowerCase().trim(), passwordHash, name.trim()]
    );
    return { id, email: email.toLowerCase().trim(), name: name.trim(), role: 'user', subscription: 'free' };
  },

  async findOrCreateFromGoogle({ email, name }) {
    let user = await User.findByEmail(email);
    if (user) {
      return { id: user.id, email: user.email, name: user.name, role: user.role, subscription: user.subscription };
    }

    const id = uuid();
    await db.query(
      "INSERT INTO users (id, email, password_hash, name, email_verified) VALUES (?, ?, '', ?, 1)",
      [id, email.toLowerCase().trim(), name.trim()]
    );
    return { id, email: email.toLowerCase().trim(), name: name.trim(), role: 'user', subscription: 'free' };
  }
};

module.exports = User;
