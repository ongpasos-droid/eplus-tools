const db = require('../utils/db');
const uuid = require('../utils/uuid');

const Project = {
  async findAllByUser(userId) {
    const [rows] = await db.query(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create({ userId, name, type, description, startDate, durationMonths, deadline, euGrant, cofinPct, indirectPct }) {
    const id = uuid();
    await db.query(
      `INSERT INTO projects (id, user_id, name, type, description, start_date, duration_months, deadline, eu_grant, cofin_pct, indirect_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, name, type, description, startDate, durationMonths, deadline, euGrant, cofinPct, indirectPct]
    );
    return { id };
  },

  async update(id, fields) {
    const allowed = ['name', 'type', 'description', 'start_date', 'duration_months', 'deadline', 'eu_grant', 'cofin_pct', 'indirect_pct', 'status'];
    const updates = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      const dbKey = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase()); // camelCase → snake_case
      if (allowed.includes(dbKey)) {
        updates.push(`${dbKey} = ?`);
        values.push(val);
      }
    }

    if (updates.length === 0) return false;
    values.push(id);
    await db.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
    return true;
  },

  async delete(id) {
    const [result] = await db.query('DELETE FROM projects WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = Project;
