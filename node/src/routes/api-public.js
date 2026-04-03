/**
 * Public API routes — /api/projects
 * Simplified endpoints for the intake frontend (no auth required).
 * Full CRUD: create, list, get, update, delete — including partners + intake_context in one call.
 */
const { Router } = require('express');
const db = require('../utils/db');
const uuid = require('../utils/uuid');

const router = Router();

// ─── POST /api/projects — save full intake ─────────────────────
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { program, fields, partners, intake } = req.body;

    if (!fields || !fields.proj_name) {
      return res.status(400).json({ ok: false, error: 'proj_name is required' });
    }

    const projectId = uuid();
    await conn.query(
      `INSERT INTO projects (id, user_id, name, type, description, start_date, duration_months, deadline, eu_grant, cofin_pct, indirect_pct, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        'public',
        fields.proj_name,
        fields.proj_type || program || null,
        fields.proj_desc || null,
        fields.proj_start || null,
        fields.months ? Number(fields.months) : null,
        intake?.deadline || null,
        fields.eu_grant ? Number(fields.eu_grant) : null,
        fields.cofin_pct ? Number(fields.cofin_pct) : null,
        fields.indirect_pct ? Number(fields.indirect_pct) : null,
        'draft',
      ]
    );

    if (partners && partners.length > 0) {
      const vals = partners.map((p) => [
        uuid(), projectId, p.name, p.country || null, p.role || 'partner', p.order_index || 0,
      ]);
      await conn.query(
        'INSERT INTO partners (id, project_id, name, country, role, order_index) VALUES ?',
        [vals]
      );
    }

    if (intake?.idea) {
      await conn.query(
        `INSERT INTO intake_contexts (id, project_id, problem, target_groups, approach)
         VALUES (?, ?, ?, ?, ?)`,
        [
          uuid(),
          projectId,
          intake.idea.problem || null,
          intake.idea.target_groups || null,
          intake.idea.approach || null,
        ]
      );
    }

    await conn.commit();
    res.status(201).json({ ok: true, id: projectId, message: 'Proyecto guardado' });
  } catch (e) {
    await conn.rollback();
    console.error('POST /api/projects error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    conn.release();
  }
});

// ─── GET /api/projects — list all ──────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, type, status, created_at, updated_at FROM projects ORDER BY updated_at DESC'
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── GET /api/projects/:id — full project ──────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [projects] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (projects.length === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });

    const [partners] = await db.query(
      'SELECT * FROM partners WHERE project_id = ? ORDER BY order_index',
      [req.params.id]
    );
    const [contexts] = await db.query(
      'SELECT * FROM intake_contexts WHERE project_id = ?',
      [req.params.id]
    );

    res.json({
      ok: true,
      data: { ...projects[0], partners, intake: contexts[0] || null },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── PUT /api/projects/:id — update full project ───────────────
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { program, fields, partners, intake } = req.body;
    const pid = req.params.id;

    await conn.query(
      `UPDATE projects SET name=?, type=?, description=?, start_date=?, duration_months=?, deadline=?, eu_grant=?, cofin_pct=?, indirect_pct=?
       WHERE id=?`,
      [
        fields.proj_name,
        fields.proj_type || program || null,
        fields.proj_desc || null,
        fields.proj_start || null,
        fields.months ? Number(fields.months) : null,
        intake?.deadline || null,
        fields.eu_grant ? Number(fields.eu_grant) : null,
        fields.cofin_pct ? Number(fields.cofin_pct) : null,
        fields.indirect_pct ? Number(fields.indirect_pct) : null,
        pid,
      ]
    );

    await conn.query('DELETE FROM partners WHERE project_id = ?', [pid]);
    if (partners && partners.length > 0) {
      const vals = partners.map((p) => [
        uuid(), pid, p.name, p.country || null, p.role || 'partner', p.order_index || 0,
      ]);
      await conn.query(
        'INSERT INTO partners (id, project_id, name, country, role, order_index) VALUES ?',
        [vals]
      );
    }

    await conn.query('DELETE FROM intake_contexts WHERE project_id = ?', [pid]);
    if (intake?.idea) {
      await conn.query(
        `INSERT INTO intake_contexts (id, project_id, problem, target_groups, approach)
         VALUES (?, ?, ?, ?, ?)`,
        [uuid(), pid, intake.idea.problem || null, intake.idea.target_groups || null, intake.idea.approach || null]
      );
    }

    await conn.commit();
    res.json({ ok: true, id: pid, message: 'Proyecto actualizado' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    conn.release();
  }
});

// ─── DELETE /api/projects/:id ──────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, message: 'Proyecto eliminado' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
