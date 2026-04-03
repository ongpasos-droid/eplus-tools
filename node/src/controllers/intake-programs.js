const IntakeProgram = require('../models/intake-program');

const IntakeProgramsController = {
  async list(req, res) {
    try {
      const programs = await IntakeProgram.findAllActive();
      res.json({ ok: true, data: programs });
    } catch (err) {
      console.error('List programs error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },
};

module.exports = IntakeProgramsController;
