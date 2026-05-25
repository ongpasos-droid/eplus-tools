/* ── Diagnose Routes — /v1/diagnose/* ───────────────────────────────────
   Admin endpoints over pattern_library, evaluation_letters and evaluation_findings.
   Future phases add: /v1/diagnose/run, /v1/diagnose/upload-proposal,
   /v1/diagnose/upload-letter, /v1/improve/*.
*/
const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl = require('./controller');

function requireAdminOrScribe(req, res, next) {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'scribe') {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin only' } });
  }
  next();
}

const guard = [requireAuth, requireAdminOrScribe];

/* ── Patterns ────────────────────────────────────────────────────────── */
// All patterns (admin overview). Pass ?all=1 to include inactive.
router.get('/patterns',                          guard, ctrl.listPatterns);
// Patterns applicable to a specific call (intake_programs.id UUID).
router.get('/patterns/by-call/:callId',          guard, ctrl.listPatternsForCall);
// Patterns by external programme code (intake_programs.program_id VARCHAR).
router.get('/patterns/by-programme/:programmeCode', guard, ctrl.listPatternsByProgrammeCode);

/* ── Letters & findings (audit trail) ────────────────────────────────── */
router.get('/letters',                           guard, ctrl.listLetters);
router.get('/letters/:id',                       guard, ctrl.getLetter);

/* ── Stats (dashboard) ────────────────────────────────────────────────── */
router.get('/stats',                             guard, ctrl.getStats);

/* ── Diagnose runs (Fase 2) ──────────────────────────────────────────── */
// Any authenticated user can run/read diagnoses on projects they own.
// The engine validates ownership through the project_id chain.
router.post('/run',                              requireAuth, ctrl.runDiagnosis);
router.get('/runs/:runId',                       requireAuth, ctrl.getRun);
router.get('/runs/project/:projectId/latest',    requireAuth, ctrl.getLatestRunForProject);

module.exports = router;
