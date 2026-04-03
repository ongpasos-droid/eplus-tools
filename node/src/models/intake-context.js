const db = require('../utils/db');
const uuid = require('../utils/uuid');

const IntakeContext = {
  async findByProject(projectId) {
    const [rows] = await db.query(
      'SELECT * FROM intake_contexts WHERE project_id = ?',
      [projectId]
    );
    return rows[0] || null;
  },

  async upsert(projectId, { problem, targetGroups, approach }) {
    const existing = await IntakeContext.findByProject(projectId);

    if (existing) {
      await db.query(
        `UPDATE intake_contexts SET problem = ?, target_groups = ?, approach = ? WHERE project_id = ?`,
        [problem, targetGroups, approach, projectId]
      );
      return { id: existing.id, updated: true };
    }

    const id = uuid();
    await db.query(
      `INSERT INTO intake_contexts (id, project_id, problem, target_groups, approach) VALUES (?, ?, ?, ?, ?)`,
      [id, projectId, problem, targetGroups, approach]
    );
    return { id, updated: false };
  },
};

module.exports = IntakeContext;
