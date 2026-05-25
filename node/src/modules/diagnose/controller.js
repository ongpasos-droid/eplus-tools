/* ── Diagnose controller — admin endpoints for pattern_library + letters ─── */
const model = require('./model');
const engine = require('./engine');

function ok(res, data) {
  return res.json({ ok: true, data });
}
function bad(res, code, message, status = 400) {
  return res.status(status).json({ ok: false, error: { code, message } });
}

exports.listPatterns = async (req, res, next) => {
  try {
    const activeOnly = req.query.all !== '1';
    const data = await model.listAllPatterns({ activeOnly });
    ok(res, data);
  } catch (e) { next(e); }
};

exports.listPatternsForCall = async (req, res, next) => {
  try {
    const callId = req.params.callId;
    if (!callId) return bad(res, 'BAD_REQUEST', 'callId is required');
    const data = await model.listPatternsForCall(callId);
    ok(res, data);
  } catch (e) { next(e); }
};

exports.listPatternsByProgrammeCode = async (req, res, next) => {
  try {
    const code = req.params.programmeCode;
    if (!code) return bad(res, 'BAD_REQUEST', 'programmeCode is required');
    const data = await model.listPatternsByProgrammeCode(code);
    ok(res, data);
  } catch (e) { next(e); }
};

exports.listLetters = async (req, res, next) => {
  try {
    const data = await model.listLetters();
    ok(res, data);
  } catch (e) { next(e); }
};

exports.getLetter = async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = await model.getLetterWithFindings(id);
    if (!data) return bad(res, 'NOT_FOUND', 'Letter not found', 404);
    ok(res, data);
  } catch (e) { next(e); }
};

exports.getStats = async (req, res, next) => {
  try {
    const data = await model.getStats();
    ok(res, data);
  } catch (e) { next(e); }
};

/* ── Diagnose engine endpoints (Fase 2) ─────────────────────────────── */

exports.runDiagnosis = async (req, res, next) => {
  try {
    const { projectId } = req.body || {};
    if (!projectId) return bad(res, 'BAD_REQUEST', 'projectId is required');
    const run = await engine.runDiagnosis(projectId, { userId: req.user?.sub });
    ok(res, run);
  } catch (e) {
    if (/not found|nothing to diagnose/i.test(e.message)) {
      return bad(res, 'NOT_FOUND', e.message, 404);
    }
    next(e);
  }
};

exports.getRun = async (req, res, next) => {
  try {
    const run = await engine.getRunWithFindings(req.params.runId);
    if (!run) return bad(res, 'NOT_FOUND', 'Run not found', 404);
    ok(res, run);
  } catch (e) { next(e); }
};

exports.getLatestRunForProject = async (req, res, next) => {
  try {
    const run = await engine.getLatestRunForProject(req.params.projectId);
    if (!run) return ok(res, null);
    ok(res, run);
  } catch (e) { next(e); }
};
