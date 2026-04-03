const { Router } = require('express');
const rateLimit  = require('express-rate-limit');
const AuthController = require('../controllers/auth');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();

/* ── Rate limiter for auth endpoints (5 req/min per IP) ──────── */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a minute.' } }
});

/* ── Endpoints ───────────────────────────────────────────────── */
router.post('/register', authLimiter, validate({ email: 'required', password: 'required', name: 'required' }), AuthController.register);
router.post('/login',    authLimiter, validate({ email: 'required', password: 'required' }), AuthController.login);
router.post('/google',   authLimiter, AuthController.google);
router.post('/refresh',  AuthController.refresh);
router.get('/me',        requireAuth, AuthController.me);
router.post('/logout',   AuthController.logout);

module.exports = router;
