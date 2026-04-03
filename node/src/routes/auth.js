const { Router } = require('express');
const AuthController = require('../controllers/auth');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();

router.post('/register', validate({ email: 'required', password: 'required', name: 'required' }), AuthController.register);
router.post('/login', validate({ email: 'required', password: 'required' }), AuthController.login);
router.get('/me', requireAuth, AuthController.me);

module.exports = router;
