const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * Middleware: verify JWT from Authorization header.
 * Sets req.user = { id, email, role, subscription }
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token required' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      subscription: payload.subscription,
    };
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}

/**
 * Generate a JWT for a user.
 */
function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
    },
    SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { requireAuth, signToken, SECRET };
