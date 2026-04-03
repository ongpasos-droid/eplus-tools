const { Router } = require('express');
const ProjectsController = require('../controllers/projects');
const PartnersController = require('../controllers/partners');
const IntakeContextsController = require('../controllers/intake-contexts');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();

// All project routes require auth
router.use(requireAuth);

// Projects CRUD
router.get('/', ProjectsController.list);
router.get('/:id', ProjectsController.get);
router.post('/', validate({ name: 'required', type: 'required', startDate: 'required', durationMonths: 'required', euGrant: 'required', cofinPct: 'required', indirectPct: 'required' }), ProjectsController.create);
router.patch('/:id', ProjectsController.update);
router.delete('/:id', ProjectsController.remove);

// Partners (nested under project for create/list)
router.get('/:projectId/partners', PartnersController.list);
router.post('/:projectId/partners', validate({ name: 'required', country: 'required', role: 'required', orderIndex: 'required' }), PartnersController.create);

// Intake contexts (nested under project)
router.get('/:projectId/intake-contexts', IntakeContextsController.get);
router.post('/:projectId/intake-contexts', IntakeContextsController.upsert);

module.exports = router;
