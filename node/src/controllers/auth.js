const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { signToken } = require('../middleware/auth');

const AuthController = {
  async register(req, res) {
    try {
      const { email, password, name } = req.body;

      const existing = await User.findByEmail(email);
      if (existing) {
        return res.status(409).json({ ok: false, error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({ email, passwordHash, name });
      const token = signToken(user);

      res.status(201).json({ ok: true, data: { user, token } });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
      }

      const token = signToken(user);
      res.json({
        ok: true,
        data: {
          user: { id: user.id, email: user.email, name: user.name, role: user.role, subscription: user.subscription },
          token,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async me(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
      res.json({ ok: true, data: user });
    } catch (err) {
      console.error('Me error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },
};

module.exports = AuthController;
