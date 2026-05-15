/* ═══════════════════════════════════════════════════════════════
   Master Document — Model layer (stubs, CRUD básico)
   ═══════════════════════════════════════════════════════════════
   Implementa la persistencia para el Documento Maestro y todo
   su ecosistema (capítulos, exports, chat, mapping, etc.) tal
   como se define en docs/PROJECT_MASTER_ARCHITECTURE.md.

   IMPORTANTE: esto son STUBS. Solo CRUD básico. El pipeline LLM
   (CAG, regeneración, diagnóstico, compresión) NO está conectado
   todavía — se conectará en una segunda iteración con Oscar
   delante para validar prompts y coste.

   Tablas asociadas (migración 103):
     - master_documents
     - master_chapters
     - master_exports
     - chat_threads
     - chat_messages
     - call_form_templates
     - call_form_questions
     - master_to_form_mapping
     - call_documents
     - master_diagnoses
     - master_diagnosis_items
   ═══════════════════════════════════════════════════════════════ */

const pool = require('../../utils/db');
const genUUID = require('../../utils/uuid');

/* ── master_documents ───────────────────────────────────────── */

async function listMasterDocumentsByProject(projectId) {
  const [rows] = await pool.query(
    `SELECT id, project_id, version_tag, version_label, status, language,
            total_chars, parent_id, created_at, updated_at
     FROM master_documents
     WHERE project_id = ?
     ORDER BY created_at DESC`,
    [projectId]
  );
  return rows;
}

async function getMasterDocument(id) {
  const [rows] = await pool.query(
    'SELECT * FROM master_documents WHERE id = ?', [id]
  );
  return rows[0] || null;
}

async function createMasterDocument({ projectId, versionTag, versionLabel, language, parentId }) {
  const id = genUUID();
  await pool.query(
    `INSERT INTO master_documents (id, project_id, version_tag, version_label, status, language, parent_id)
     VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
    [id, projectId, versionTag || 'v1', versionLabel || null, language || 'es', parentId || null]
  );
  return getMasterDocument(id);
}

async function updateMasterDocument(id, data) {
  const fields = [];
  const params = [];
  for (const key of ['version_tag', 'version_label', 'status', 'language', 'total_chars']) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
  }
  if (!fields.length) return getMasterDocument(id);
  params.push(id);
  await pool.query(`UPDATE master_documents SET ${fields.join(', ')} WHERE id = ?`, params);
  return getMasterDocument(id);
}

async function deleteMasterDocument(id) {
  await pool.query('DELETE FROM master_documents WHERE id = ?', [id]);
}

/* ── master_chapters ─────────────────────────────────────────── */

async function listChapters(masterDocId) {
  const [rows] = await pool.query(
    `SELECT id, master_doc_id, chapter_key, chapter_type, title, body, sort_order,
            parent_chapter_id, ref_entity_type, ref_entity_id, char_count,
            last_ai_edit_at, last_human_edit_at, created_at, updated_at
     FROM master_chapters
     WHERE master_doc_id = ?
     ORDER BY sort_order, created_at`,
    [masterDocId]
  );
  return rows;
}

async function getChapter(id) {
  const [rows] = await pool.query(
    'SELECT * FROM master_chapters WHERE id = ?', [id]
  );
  return rows[0] || null;
}

async function createChapter({ masterDocId, chapterKey, chapterType, title, body, sortOrder, parentChapterId, refEntityType, refEntityId }) {
  const id = genUUID();
  const charCount = body ? body.length : 0;
  await pool.query(
    `INSERT INTO master_chapters
       (id, master_doc_id, chapter_key, chapter_type, title, body, sort_order,
        parent_chapter_id, ref_entity_type, ref_entity_id, char_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, masterDocId, chapterKey, chapterType, title, body || null, sortOrder || 0,
     parentChapterId || null, refEntityType || null, refEntityId || null, charCount]
  );
  return getChapter(id);
}

async function updateChapter(id, data, opts = {}) {
  const fields = [];
  const params = [];
  for (const key of ['chapter_key', 'chapter_type', 'title', 'body', 'sort_order',
                     'parent_chapter_id', 'ref_entity_type', 'ref_entity_id']) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
  }
  // Auto-update char_count si tocamos body
  if (data.body !== undefined) {
    fields.push('char_count = ?');
    params.push((data.body || '').length);
  }
  // Marcar quién editó por último (humano vs IA) si se nos dice
  if (opts.actor === 'ai') {
    fields.push('last_ai_edit_at = CURRENT_TIMESTAMP');
  } else if (opts.actor === 'human') {
    fields.push('last_human_edit_at = CURRENT_TIMESTAMP');
  }
  if (!fields.length) return getChapter(id);
  params.push(id);
  await pool.query(`UPDATE master_chapters SET ${fields.join(', ')} WHERE id = ?`, params);
  return getChapter(id);
}

async function deleteChapter(id) {
  await pool.query('DELETE FROM master_chapters WHERE id = ?', [id]);
}

/* ── master_exports ──────────────────────────────────────────── */

async function listExports(projectId) {
  const [rows] = await pool.query(
    `SELECT id, master_doc_id, project_id, export_kind, call_id, form_template_id,
            language, state, pdf_path, page_count, size_bytes,
            generated_by_user_id, exported_at, marked_at, notes
     FROM master_exports
     WHERE project_id = ?
     ORDER BY exported_at DESC`,
    [projectId]
  );
  return rows;
}

async function getExport(id) {
  const [rows] = await pool.query('SELECT * FROM master_exports WHERE id = ?', [id]);
  return rows[0] || null;
}

async function createExport(data) {
  const id = genUUID();
  await pool.query(
    `INSERT INTO master_exports
       (id, master_doc_id, project_id, export_kind, call_id, form_template_id,
        language, state, pdf_path, page_count, size_bytes,
        generated_by_user_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.masterDocId, data.projectId, data.exportKind, data.callId || null,
     data.formTemplateId || null, data.language || 'es', data.state || 'borrador',
     data.pdfPath || null, data.pageCount || null, data.sizeBytes || null,
     data.generatedByUserId || null, data.notes || null]
  );
  return getExport(id);
}

async function markExportReady(id) {
  await pool.query(
    `UPDATE master_exports
     SET state = 'lista_para_presentar', marked_at = CURRENT_TIMESTAMP
     WHERE id = ?`, [id]
  );
  return getExport(id);
}

/* ── chat_threads + chat_messages ────────────────────────────── */

async function getOrCreateMainThread(projectId, userId, phase) {
  const phaseVal = phase || 'perfect';
  const [existing] = await pool.query(
    `SELECT * FROM chat_threads
     WHERE project_id = ? AND phase = ? AND is_archived = 0
     ORDER BY updated_at DESC LIMIT 1`,
    [projectId, phaseVal]
  );
  if (existing[0]) return existing[0];

  const id = genUUID();
  await pool.query(
    `INSERT INTO chat_threads (id, project_id, user_id, phase, title)
     VALUES (?, ?, ?, ?, 'Hilo de proyecto')`,
    [id, projectId, userId, phaseVal]
  );
  const [rows] = await pool.query('SELECT * FROM chat_threads WHERE id = ?', [id]);
  return rows[0];
}

async function listThreads(projectId) {
  const [rows] = await pool.query(
    `SELECT * FROM chat_threads WHERE project_id = ? ORDER BY updated_at DESC`,
    [projectId]
  );
  return rows;
}

async function listMessages(threadId, { limit = 200, before } = {}) {
  const params = [threadId];
  let sql = 'SELECT * FROM chat_messages WHERE thread_id = ?';
  if (before) { sql += ' AND created_at < ?'; params.push(before); }
  sql += ' ORDER BY created_at ASC LIMIT ?';
  params.push(Number(limit));
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function appendMessage(threadId, msg) {
  const id = genUUID();
  await pool.query(
    `INSERT INTO chat_messages
       (id, thread_id, role, content, anchor_kind, anchor_id, anchor_label,
        applied_to_master, master_chapter_id, llm_model,
        llm_input_tokens, llm_output_tokens, llm_cached_tokens, cache_breakpoint)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, threadId, msg.role, msg.content,
     msg.anchorKind || null, msg.anchorId || null, msg.anchorLabel || null,
     msg.appliedToMaster ? 1 : 0, msg.masterChapterId || null, msg.llmModel || null,
     msg.llmInputTokens || null, msg.llmOutputTokens || null,
     msg.llmCachedTokens || null, msg.cacheBreakpoint ? 1 : 0]
  );
  // Touch thread last_message_at
  await pool.query(
    `UPDATE chat_threads SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [threadId]
  );
  const [rows] = await pool.query('SELECT * FROM chat_messages WHERE id = ?', [id]);
  return rows[0];
}

/* ── call_form_templates + questions + mapping ───────────────── */

async function listFormTemplates(callId) {
  const [rows] = await pool.query(
    `SELECT * FROM call_form_templates WHERE call_id = ? AND is_active = 1
     ORDER BY budget_threshold_eur`,
    [callId]
  );
  return rows;
}

async function getFormTemplate(id) {
  const [rows] = await pool.query('SELECT * FROM call_form_templates WHERE id = ?', [id]);
  return rows[0] || null;
}

async function listFormQuestions(formTemplateId) {
  const [rows] = await pool.query(
    `SELECT * FROM call_form_questions WHERE form_template_id = ? ORDER BY sort_order`,
    [formTemplateId]
  );
  return rows;
}

async function listMappingForTemplate(formTemplateId) {
  const [rows] = await pool.query(
    `SELECT * FROM master_to_form_mapping WHERE form_template_id = ? ORDER BY sort_order`,
    [formTemplateId]
  );
  return rows;
}

/* ── call_documents (CAG core sources) ───────────────────────── */

async function listCallDocuments(callId) {
  const [rows] = await pool.query(
    `SELECT id, call_id, doc_kind, title, source_filename, language,
            page_count, char_count, token_count_est, is_core,
            uploaded_by_user_id, created_at, updated_at
     FROM call_documents
     WHERE call_id = ?
     ORDER BY is_core DESC, doc_kind, title`,
    [callId]
  );
  return rows;
}

async function getCallDocumentBody(id) {
  const [rows] = await pool.query(
    `SELECT id, body_text, char_count, token_count_est FROM call_documents WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

/* ── Diagnoses ───────────────────────────────────────────────── */

async function listDiagnoses(masterDocId) {
  const [rows] = await pool.query(
    `SELECT * FROM master_diagnoses WHERE master_doc_id = ? ORDER BY started_at DESC`,
    [masterDocId]
  );
  return rows;
}

async function getDiagnosisWithItems(diagnosisId) {
  const [diag] = await pool.query('SELECT * FROM master_diagnoses WHERE id = ?', [diagnosisId]);
  if (!diag[0]) return null;
  const [items] = await pool.query(
    `SELECT * FROM master_diagnosis_items WHERE diagnosis_id = ? ORDER BY classification, severity DESC, sort_order`,
    [diagnosisId]
  );
  return { ...diag[0], items };
}

/* ── exports ─────────────────────────────────────────────────── */

module.exports = {
  // master_documents
  listMasterDocumentsByProject,
  getMasterDocument,
  createMasterDocument,
  updateMasterDocument,
  deleteMasterDocument,
  // master_chapters
  listChapters,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
  // master_exports
  listExports,
  getExport,
  createExport,
  markExportReady,
  // chat
  getOrCreateMainThread,
  listThreads,
  listMessages,
  appendMessage,
  // form templates + mapping
  listFormTemplates,
  getFormTemplate,
  listFormQuestions,
  listMappingForTemplate,
  // call documents
  listCallDocuments,
  getCallDocumentBody,
  // diagnoses
  listDiagnoses,
  getDiagnosisWithItems,
};
