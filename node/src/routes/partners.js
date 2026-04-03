const { Router } = require('express');
const PartnersController = require('../controllers/partners');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);

// Flat routes for update/delete (only need partner ID)
router.patch('/:id', PartnersController.update);
router.delete('/:id', PartnersController.remove);

module.exports = router;
