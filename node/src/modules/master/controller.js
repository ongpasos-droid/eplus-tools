/* ═══════════════════════════════════════════════════════════════
   Master Document — Controller (HTTP layer)
   ═══════════════════════════════════════════════════════════════
   Stubs CRUD. NO conecta LLM todavía. Las funciones de regeneración,
   diagnóstico, compresión y export se añaden en la fase siguiente
   (ver docs/PROJECT_MASTER_IMPLEMENTATION_PLAN.md).

   Convención de respuesta (CLAUDE.md §"Cómo trabajar con el código"):
     { ok: true, data: ... } | { ok: false, error: ... }
   ═══════════════════════════════════════════════════════════════ */

const model = require('./model');

function ok(res, data) { res.json({ ok: true, data }); }
function bad(res, status, error) { res.status(status).json({ ok: false, error }); }

/* ── Documents ───────────────────────────────────────────────── */

async function listMasterDocuments(req, res) {
  try {
    const docs = await model.listMasterDocumentsByProject(req.params.projectId);
    ok(res, docs);
  } catch (e) { bad(res, 500, e.message); }
}

async function getMasterDocument(req, res) {
  try {
    const doc = await model.getMasterDocument(req.params.id);
    if (!doc) return bad(res, 404, 'master_document not found');
    const chapters = await model.listChapters(doc.id);
    ok(res, { ...doc, chapters });
  } catch (e) { bad(res, 500, e.message); }
}

async function createMasterDocument(req, res) {
  try {
    const projectId = req.params.projectId;
    const { versionTag, versionLabel, language, parentId } = req.body || {};
    const doc = await model.createMasterDocument({ projectId, versionTag, versionLabel, language, parentId });
    ok(res, doc);
  } catch (e) { bad(res, 500, e.message); }
}

async function updateMasterDocument(req, res) {
  try {
    const doc = await model.updateMasterDocument(req.params.id, req.body || {});
    if (!doc) return bad(res, 404, 'master_document not found');
    ok(res, doc);
  } catch (e) { bad(res, 500, e.message); }
}

async function deleteMasterDocument(req, res) {
  try {
    await model.deleteMasterDocument(req.params.id);
    ok(res, { deleted: true });
  } catch (e) { bad(res, 500, e.message); }
}

/* ── Chapters ────────────────────────────────────────────────── */

async function listChapters(req, res) {
  try {
    const chapters = await model.listChapters(req.params.id);
    ok(res, chapters);
  } catch (e) { bad(res, 500, e.message); }
}

async function createChapter(req, res) {
  try {
    const masterDocId = req.params.id;
    const body = req.body || {};
    if (!body.chapterKey || !body.chapterType || !body.title) {
      return bad(res, 400, 'chapterKey, chapterType and title are required');
    }
    const chapter = await model.createChapter({ masterDocId, ...body });
    ok(res, chapter);
  } catch (e) { bad(res, 500, e.message); }
}

async function updateChapter(req, res) {
  try {
    const actor = req.body && req.body._actor === 'ai' ? 'ai' : 'human';
    // Normaliza body para que use snake_case en la BD
    const patch = {};
    const b = req.body || {};
    for (const [src, dst] of Object.entries({
      chapterKey: 'chapter_key', chapterType: 'chapter_type', title: 'title',
      body: 'body', sortOrder: 'sort_order', parentChapterId: 'parent_chapter_id',
      refEntityType: 'ref_entity_type', refEntityId: 'ref_entity_id'
    })) {
      if (b[src] !== undefined) patch[dst] = b[src];
    }
    const chapter = await model.updateChapter(req.params.id, patch, { actor });
    if (!chapter) return bad(res, 404, 'chapter not found');
    ok(res, chapter);
  } catch (e) { bad(res, 500, e.message); }
}

async function deleteChapter(req, res) {
  try {
    await model.deleteChapter(req.params.id);
    ok(res, { deleted: true });
  } catch (e) { bad(res, 500, e.message); }
}

/* ── Exports ─────────────────────────────────────────────────── */

async function listExports(req, res) {
  try {
    const rows = await model.listExports(req.params.projectId);
    ok(res, rows);
  } catch (e) { bad(res, 500, e.message); }
}

async function markExportReady(req, res) {
  try {
    const row = await model.markExportReady(req.params.id);
    if (!row) return bad(res, 404, 'export not found');
    ok(res, row);
  } catch (e) { bad(res, 500, e.message); }
}

/* ── Chat ────────────────────────────────────────────────────── */

async function getOrCreateMainThread(req, res) {
  try {
    const projectId = req.params.projectId;
    const phase = req.query.phase || 'perfect';
    const thread = await model.getOrCreateMainThread(projectId, req.user.id, phase);
    ok(res, thread);
  } catch (e) { bad(res, 500, e.message); }
}

async function listMessages(req, res) {
  try {
    const messages = await model.listMessages(req.params.id, {
      limit: parseInt(req.query.limit, 10) || 200,
      before: req.query.before || null,
    });
    ok(res, messages);
  } catch (e) { bad(res, 500, e.message); }
}

async function appendMessage(req, res) {
  try {
    const threadId = req.params.id;
    const msg = req.body || {};
    if (!msg.role || !msg.content) return bad(res, 400, 'role and content are required');
    if (!['user', 'assistant', 'system'].includes(msg.role)) {
      return bad(res, 400, 'invalid role');
    }
    const saved = await model.appendMessage(threadId, msg);
    ok(res, saved);
  } catch (e) { bad(res, 500, e.message); }
}

/* ── Form templates & mapping ────────────────────────────────── */

async function listFormTemplates(req, res) {
  try {
    const templates = await model.listFormTemplates(req.params.callId);
    ok(res, templates);
  } catch (e) { bad(res, 500, e.message); }
}

async function getFormTemplateFull(req, res) {
  try {
    const tpl = await model.getFormTemplate(req.params.id);
    if (!tpl) return bad(res, 404, 'form template not found');
    const questions = await model.listFormQuestions(tpl.id);
    const mapping = await model.listMappingForTemplate(tpl.id);
    ok(res, { ...tpl, questions, mapping });
  } catch (e) { bad(res, 500, e.message); }
}

/* ── Call documents (CAG sources) ────────────────────────────── */

async function listCallDocuments(req, res) {
  try {
    const docs = await model.listCallDocuments(req.params.callId);
    ok(res, docs);
  } catch (e) { bad(res, 500, e.message); }
}

/* ── Diagnoses ───────────────────────────────────────────────── */

async function listDiagnoses(req, res) {
  try {
    const rows = await model.listDiagnoses(req.params.id);
    ok(res, rows);
  } catch (e) { bad(res, 500, e.message); }
}

async function getDiagnosis(req, res) {
  try {
    const diag = await model.getDiagnosisWithItems(req.params.id);
    if (!diag) return bad(res, 404, 'diagnosis not found');
    ok(res, diag);
  } catch (e) { bad(res, 500, e.message); }
}

/* ── Placeholders LLM (devolverán 501 hasta que se conecten) ─── */

async function notImplemented(req, res) {
  res.status(501).json({
    ok: false,
    error: 'Endpoint placeholder — pipeline LLM no conectado todavía.',
    next_steps: 'Ver docs/PROJECT_MASTER_IMPLEMENTATION_PLAN.md fase 3+',
  });
}

module.exports = {
  // documents
  listMasterDocuments,
  getMasterDocument,
  createMasterDocument,
  updateMasterDocument,
  deleteMasterDocument,
  // chapters
  listChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  // exports
  listExports,
  markExportReady,
  // chat
  getOrCreateMainThread,
  listMessages,
  appendMessage,
  // form templates
  listFormTemplates,
  getFormTemplateFull,
  // call documents
  listCallDocuments,
  // diagnoses
  listDiagnoses,
  getDiagnosis,
  // placeholders LLM (501 hasta conectar)
  compileMasterV1: notImplemented,
  regenerateWithUnifiedContext: notImplemented,
  runDiagnosis: notImplemented,
  computeScoreEstimate: notImplemented,
  compressToForm: notImplemented,
  coherencePass: notImplemented,
};
