const db = require('../utils/db');

const IntakeProgram = {
  async findAllActive() {
    const [rows] = await db.query(
      'SELECT * FROM intake_programs WHERE active = 1 ORDER BY deadline ASC'
    );
    return rows;
  },

  async findByProgramId(programId) {
    const [rows] = await db.query(
      'SELECT * FROM intake_programs WHERE program_id = ?',
      [programId]
    );
    return rows[0] || null;
  },
};

module.exports = IntakeProgram;
