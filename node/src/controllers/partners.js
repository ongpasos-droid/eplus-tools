const Partner = require('../models/partner');
const Project = require('../models/project');

const PartnersController = {
  async list(req, res) {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      if (project.user_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Forbidden' });

      const partners = await Partner.findByProject(req.params.projectId);
      res.json({ ok: true, data: partners });
    } catch (err) {
      console.error('List partners error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async create(req, res) {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
      if (project.user_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Forbidden' });

      const { name, legalName, city, country, role, orderIndex } = req.body;
      const result = await Partner.create({
        projectId: req.params.projectId, name, legalName, city, country, role, orderIndex,
      });
      res.status(201).json({ ok: true, data: result });
    } catch (err) {
      console.error('Create partner error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async update(req, res) {
    try {
      await Partner.update(req.params.id, req.body);
      res.json({ ok: true, data: { id: req.params.id } });
    } catch (err) {
      console.error('Update partner error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },

  async remove(req, res) {
    try {
      await Partner.delete(req.params.id);
      res.json({ ok: true, data: { deleted: true } });
    } catch (err) {
      console.error('Delete partner error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },
};

module.exports = PartnersController;
