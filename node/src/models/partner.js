const db = require('../utils/db');
const uuid = require('../utils/uuid');

const Partner = {
  async findByProject(projectId) {
    const [rows] = await db.query(
      'SELECT * FROM partners WHERE project_id = ? ORDER BY order_index ASC',
      [projectId]
    );
    return rows;
  },

  async create({ projectId, name, legalName, city, country, role, orderIndex }) {
    const id = uuid();
    await db.query(
      `INSERT INTO partners (id, project_id, name, legal_name, city, country, role, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, name, legalName, city, country, role, orderIndex]
    );
    return { id };
  },

  async update(id, fields) {
    const allowed = ['name', 'legal_name', 'city', 'country', 'role', 'order_index'];
    const updates = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      const dbKey = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      if (allowed.includes(dbKey)) {
        updates.push(`${dbKey} = ?`);
        values.push(val);
      }
    }

    if (updates.length === 0) return false;
    values.push(id);
    await db.query(`UPDATE partners SET ${updates.join(', ')} WHERE id = ?`, values);
    return true;
  },

  async delete(id) {
    const [result] = await db.query('DELETE FROM partners WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = Partner;
