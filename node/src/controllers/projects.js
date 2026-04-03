const Project = require('../models/project');

const ProjectsController = {
  async list(req, res) {
    try {
      const projects = await Project.findAllByUser(req.user.id);
      res.json({ ok: true, data: projects });
    } catch (err) {
      console.error('List projects error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async get(req, res) {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      if (project.user_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Forbidden' });
      res.json({ ok: true, data: project });
    } catch (err) {
      console.error('Get project error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async create(req, res) {
    try {
      const { name, type, description, startDate, durationMonths, deadline, euGrant, cofinPct, indirectPct } = req.body;
      const result = await Project.create({
        userId: req.user.id,
        name, type, description, startDate, durationMonths, deadline, euGrant, cofinPct, indirectPct,
      });
      res.status(201).json({ ok: true, data: result });
    } catch (err) {
      console.error('Create project error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async update(req, res) {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      if (project.user_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Forbidden' });

      await Project.update(req.params.id, req.body);
      res.json({ ok: true, data: { id: req.params.id } });
    } catch (err) {
      console.error('Update project error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async remove(req, res) {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      if (project.user_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Forbidden' });

      await Project.delete(req.params.id);
      res.json({ ok: true, data: { deleted: true } });
    } catch (err) {
      console.error('Delete project error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },
};

module.exports = ProjectsController;
