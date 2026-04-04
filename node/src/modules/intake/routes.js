/* ── Intake Routes — /v1/intake/* ─────────────────────────────────── */

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl = require('./controller');

/* ── Programs (public endpoints) ────────────────────────────────── */
router.get('/programs', ctrl.listPrograms);

/* ── Entity search (authenticated) ────────────���────────────────── */
router.get('/entities/search', requireAuth, ctrl.searchEntities);

/* ── Projects (all authenticated) ──────────────────────────────── */
router.get('/projects', requireAuth, ctrl.listProjects);
router.get('/projects/:id', requireAuth, ctrl.getProject);
router.post('/projects', requireAuth, ctrl.createProject);
router.patch('/projects/:id', requireAuth, ctrl.updateProject);
router.delete('/projects/:id', requireAuth, ctrl.deleteProject);

/* ── Partners ──────────────────────────────────────────────────── */
router.get('/projects/:projectId/partners', requireAuth, ctrl.listPartners);
router.post('/projects/:projectId/partners', requireAuth, ctrl.createPartner);
router.patch('/partners/:id', requireAuth, ctrl.updatePartner);
router.delete('/partners/:id', requireAuth, ctrl.deletePartner);
router.patch('/projects/:projectId/partners/reorder', requireAuth, ctrl.reorderPartners);

/* ── Intake Contexts ───────────────────────────────────────────── */
router.get('/projects/:projectId/context', requireAuth, ctrl.listContexts);
router.patch('/contexts/:id', requireAuth, ctrl.updateContext);

module.exports = router;
