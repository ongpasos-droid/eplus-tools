const IntakeContext = require('../models/intake-context');
const Project = require('../models/project');

const IntakeContextsController = {
  async get(req, res) {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      if (project.user_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Forbidden' });

      const context = await IntakeContext.findByProject(req.params.projectId);
      res.json({ ok: true, data: context || null });
    } catch (err) {
      console.error('Get context error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async upsert(req, res) {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      if (project.user_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Forbidden' });

      const { problem, targetGroups, approach } = req.body;
      const result = await IntakeContext.upsert(req.params.projectId, { problem, targetGroups, approach });
      res.json({ ok: true, data: result });
    } catch (err) {
      console.error('Upsert context error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },
};

module.exports = IntakeContextsController;
