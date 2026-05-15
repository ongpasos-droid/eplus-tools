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
const cag = require('./cag-pipeline');
const developerModel = require('../developer/model');
const pool = require('../../utils/db');
const genUUID = require('../../utils/uuid');

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

/* ── LLM-powered endpoints (CAG pipeline) ─────────────────────── */

/**
 * Compila la primera versión del Master Document para un proyecto.
 * Idempotente: si ya existe un Master ready, devuelve 409.
 *
 * Inputs (req.body opcional):
 *   - dryRun: si true, devuelve solo estimación de coste sin tirar la llamada
 *   - force: si true, ignora idempotencia y crea otra versión
 */
async function compileMasterV1(req, res) {
  const masterDocId = req.params.id;
  try {
    const masterDoc = await model.getMasterDocument(masterDocId);
    if (!masterDoc) return bad(res, 404, 'master_document not found');

    const projectId = masterDoc.project_id;
    const userId = req.user.id;
    const { dryRun = false, force = false } = req.body || {};

    // Idempotencia: si ya tiene capítulos compilados, no rehacer salvo force
    if (!force) {
      const existing = await model.listChapters(masterDocId);
      if (existing.length > 0) {
        return bad(res, 409, 'Master document already has chapters. Use { force: true } to recompile.');
      }
    }

    // Construir el contexto enriquecido del proyecto (sin truncar — ver fix)
    const enrichedContext = await developerModel.buildEnrichedContext(projectId, userId);

    // Cargar interviews del Prep Studio
    const [interviewRows] = await pool.query(
      `SELECT question_text, answer_text, tab FROM writer_interviews
       WHERE project_id = ? AND answer_text IS NOT NULL AND LENGTH(answer_text) > 10
       ORDER BY tab, sort_order`,
      [projectId]
    );
    const interviews = interviewRows.map(r =>
      `[${(r.tab || 'general').toUpperCase()}]\nQ: ${r.question_text}\nA: ${r.answer_text}`
    ).join('\n\n');

    // Cargar secciones existentes del Writer cascada (si las hay)
    const [writerRows] = await pool.query(
      `SELECT ws.section_id, ws.body
       FROM writer_sections ws
       JOIN form_instances fi ON fi.id = ws.instance_id
       WHERE fi.project_id = ?
       ORDER BY ws.section_id`,
      [projectId]
    ).catch(() => [[]]);
    const writerDraft = writerRows.map(r => `=== ${r.section_id} ===\n${r.body || ''}`).join('\n\n');

    // Criterios de evaluación (si están)
    const [evalRows] = await pool.query(
      `SELECT es.code, es.title, es.max_score, eq.code AS q_code, eq.title AS q_title
       FROM projects p
       LEFT JOIN eval_sections es ON es.programme_id = p.program_id
       LEFT JOIN eval_questions eq ON eq.section_id = es.id
       WHERE p.id = ?
       ORDER BY es.code, eq.code`,
      [projectId]
    ).catch(() => [[]]);
    const evalCriteria = evalRows.length
      ? evalRows.map(r => `${r.code} ${r.title} (max ${r.max_score})${r.q_code ? `\n  - ${r.q_code} ${r.q_title}` : ''}`).join('\n')
      : 'No specific evaluation criteria loaded for this call. Use general EU evaluation patterns (Relevance, Quality, Impact, Partnership).';

    const vars = {
      call_code: '',
      criteria: evalCriteria,
      enriched_context: enrichedContext,
      writer_draft: writerDraft || '(no writer draft yet)',
      interviews: interviews || '(no interviews yet)',
    };

    // Dry-run: devolver previsión sin tirar la llamada
    if (dryRun) {
      const preview = cag.dryRun('01_compile_master_v1', vars, { maxTokens: 60000 });
      return ok(res, { dryRun: true, ...preview });
    }

    // Marcar como compiling
    await model.updateMasterDocument(masterDocId, { status: 'compiling' });

    const result = await cag.runPrompt('01_compile_master_v1', vars, {
      maxTokens: 60000,
      temperature: 0.4,
      ctx: { projectId, userId },
      endpoint: '/v1/master/documents/:id/compile-v1',
    });

    if (!result.parsed || !Array.isArray(result.parsed.chapters)) {
      await model.updateMasterDocument(masterDocId, { status: 'draft' });
      return bad(res, 502, `LLM output not parseable as expected schema. Raw: ${result.text.substring(0, 500)}`);
    }

    // Persistir capítulos
    let totalChars = 0;
    for (let i = 0; i < result.parsed.chapters.length; i++) {
      const ch = result.parsed.chapters[i];
      await model.createChapter({
        masterDocId,
        chapterKey: ch.chapter_key || `ch_${i + 1}`,
        chapterType: ch.chapter_type || 'custom',
        title: ch.title || `Capítulo ${i + 1}`,
        body: ch.body || '',
        sortOrder: i,
      });
      totalChars += (ch.body || '').length;
    }

    await model.updateMasterDocument(masterDocId, {
      status: 'ready',
      total_chars: totalChars,
    });

    ok(res, {
      master_doc_id: masterDocId,
      chapters_created: result.parsed.chapters.length,
      total_chars: totalChars,
      cost_usd: result.costUsd,
      duration_ms: result.durationMs,
      usage: result.usage,
    });
  } catch (e) {
    console.error('[compileMasterV1] error:', e);
    // Restaurar estado a draft si falló
    try { await model.updateMasterDocument(masterDocId, { status: 'draft' }); } catch (_) {}
    bad(res, e.status || 500, e.message);
  }
}

/**
 * Diagnóstico inicial sobre el Master v1. Detecta huecos y contradicciones,
 * clasificadas en narrative vs economic.
 */
async function runDiagnosis(req, res) {
  const masterDocId = req.params.id;
  try {
    const masterDoc = await model.getMasterDocument(masterDocId);
    if (!masterDoc) return bad(res, 404, 'master_document not found');

    const projectId = masterDoc.project_id;
    const userId = req.user.id;
    const { kind = 'initial', dryRun = false } = req.body || {};

    if (!['initial', 'advanced'].includes(kind)) {
      return bad(res, 400, 'kind must be "initial" or "advanced"');
    }

    const chapters = await model.listChapters(masterDocId);
    if (chapters.length === 0) {
      return bad(res, 409, 'Master document has no chapters yet. Compile first.');
    }

    const masterText = chapters
      .map(c => `## ${c.title}\n\n${c.body || ''}`)
      .join('\n\n---\n\n');

    // Design snapshot conciso para cross-checks
    const designSnapshot = await developerModel.buildEnrichedContext(projectId, userId);

    // Eval criteria
    const [evalRows] = await pool.query(
      `SELECT es.code, es.title, es.max_score, eq.code AS q_code, eq.title AS q_title
       FROM projects p
       LEFT JOIN eval_sections es ON es.programme_id = p.program_id
       LEFT JOIN eval_questions eq ON eq.section_id = es.id
       WHERE p.id = ? ORDER BY es.code, eq.code`,
      [projectId]
    ).catch(() => [[]]);
    const criteria = evalRows.map(r => `${r.code} ${r.title} (max ${r.max_score})${r.q_code ? `\n  - ${r.q_code} ${r.q_title}` : ''}`).join('\n');

    const vars = {
      call_code: '',
      criteria: criteria || 'Use general EU evaluation patterns.',
      master_document: masterText,
      design_snapshot: designSnapshot,
    };

    const promptKey = kind === 'initial' ? '02_diagnosis_initial' : '04_diagnosis_advanced';

    if (dryRun) {
      const preview = cag.dryRun(promptKey, vars, { maxTokens: 12000 });
      return ok(res, { dryRun: true, ...preview });
    }

    // Crear registro de diagnosis con status running
    const genUUID = require('../../utils/uuid');
    const diagnosisId = genUUID();
    await pool.query(
      `INSERT INTO master_diagnoses (id, master_doc_id, project_id, diagnosis_kind, status)
       VALUES (?, ?, ?, ?, 'running')`,
      [diagnosisId, masterDocId, projectId, kind === 'initial' ? 'initial' : 'advanced']
    );

    try {
      const result = await cag.runPrompt(promptKey, vars, {
        maxTokens: 12000,
        temperature: 0.3,
        ctx: { projectId, userId },
        endpoint: `/v1/master/documents/:id/diagnose:${kind}`,
      });

      if (!result.parsed) {
        await pool.query(
          `UPDATE master_diagnoses SET status='failed', finished_at=NOW() WHERE id=?`,
          [diagnosisId]
        );
        return bad(res, 502, `LLM output not parseable. Raw: ${result.text.substring(0, 500)}`);
      }

      const items = Array.isArray(result.parsed.items) ? result.parsed.items : [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await pool.query(
          `INSERT INTO master_diagnosis_items
             (id, diagnosis_id, classification, severity, title, detail, suggestion,
              anchor_kind, anchor_id, anchor_label, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [genUUID(), diagnosisId,
           it.classification || 'narrative',
           it.severity || 'warning',
           it.title || 'Sin título',
           it.detail || null,
           it.suggestion || null,
           it.anchor_kind || null,
           it.anchor_id || null,
           it.anchor_label || null,
           i]
        );
      }

      await pool.query(
        `UPDATE master_diagnoses
         SET status='ready',
             summary=?,
             llm_model=?,
             llm_input_tokens=?,
             llm_output_tokens=?,
             finished_at=NOW()
         WHERE id=?`,
        [
          result.parsed.summary || null,
          result.model,
          (result.usage?.input_tokens || 0) + (result.usage?.cache_creation_input_tokens || 0) + (result.usage?.cache_read_input_tokens || 0),
          result.usage?.output_tokens || 0,
          diagnosisId,
        ]
      );

      const full = await model.getDiagnosisWithItems(diagnosisId);
      ok(res, { ...full, cost_usd: result.costUsd, duration_ms: result.durationMs });
    } catch (e) {
      await pool.query(
        `UPDATE master_diagnoses SET status='failed', finished_at=NOW() WHERE id=?`,
        [diagnosisId]
      ).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error('[runDiagnosis] error:', e);
    bad(res, e.status || 500, e.message);
  }
}

/* ── Subida de documentos canónicos de la convocatoria (CAG sources) ── */

/**
 * Sube un PDF o DOCX a una convocatoria, extrae el texto, lo guarda en
 * call_documents.body_text para que esté disponible para el pipeline CAG.
 *
 * Multipart: req.file con campo "file". req.body con doc_kind, title,
 * language, is_core.
 */
async function uploadCallDocument(req, res) {
  try {
    if (!req.file) return bad(res, 400, 'file is required (multipart/form-data, field "file")');
    if (req.user.role !== 'admin') return bad(res, 403, 'admin role required');

    const callId = req.params.callId;
    const { doc_kind, title, language = 'en', is_core = '1' } = req.body || {};

    if (!doc_kind || !title) {
      return bad(res, 400, 'doc_kind and title are required');
    }

    const allowedKinds = ['call_pdf', 'programme_guide', 'annotated_grant', 'eval_criteria', 'reference', 'annex'];
    if (!allowedKinds.includes(doc_kind)) {
      return bad(res, 400, `doc_kind must be one of: ${allowedKinds.join(', ')}`);
    }

    // Extraer texto según mimetype
    const mime = req.file.mimetype || '';
    const filename = req.file.originalname || 'unnamed';
    let bodyText = '';

    if (mime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(req.file.buffer);
      bodyText = result.text || '';
    } else if (mime.includes('officedocument.wordprocessingml') || filename.toLowerCase().endsWith('.docx')) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      bodyText = result.value || '';
    } else if (mime.startsWith('text/') || filename.toLowerCase().endsWith('.txt') || filename.toLowerCase().endsWith('.md')) {
      bodyText = req.file.buffer.toString('utf8');
    } else {
      return bad(res, 415, `Unsupported file type: ${mime}. Use PDF, DOCX, TXT or MD.`);
    }

    const charCount = bodyText.length;
    const tokenCountEst = Math.ceil(charCount / 3.5);

    const id = genUUID();
    await pool.query(
      `INSERT INTO call_documents
         (id, call_id, doc_kind, title, source_filename, language,
          body_text, char_count, token_count_est, is_core, uploaded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, callId, doc_kind, title, filename, language,
       bodyText, charCount, tokenCountEst,
       is_core === '0' || is_core === false ? 0 : 1,
       req.user.id]
    );

    ok(res, {
      id, call_id: callId, doc_kind, title,
      char_count: charCount, token_count_est: tokenCountEst,
      preview: bodyText.substring(0, 400),
    });
  } catch (e) {
    console.error('[uploadCallDocument] error:', e);
    bad(res, 500, e.message);
  }
}

/* ── Stubs restantes (devolverán 501 hasta que se conecten) ─── */

async function notImplemented(req, res) {
  res.status(501).json({
    ok: false,
    error: 'Endpoint placeholder — pipeline LLM no conectado todavía.',
    next_steps: 'Ver docs/PROJECT_MASTER_IMPLEMENTATION_PLAN.md fase F6+',
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
  // upload call documents (CAG sources)
  uploadCallDocument,
  // LLM-powered (CAG)
  compileMasterV1,
  runDiagnosis,
  // placeholders LLM (501 hasta conectar)
  regenerateWithUnifiedContext: notImplemented,
  computeScoreEstimate: notImplemented,
  compressToForm: notImplemented,
  coherencePass: notImplemented,
};
