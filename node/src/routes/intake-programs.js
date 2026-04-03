const { Router } = require('express');
const IntakeProgramsController = require('../controllers/intake-programs');

const router = Router();

// Public — no auth required (programs are reference data)
router.get('/', IntakeProgramsController.list);

module.exports = router;
