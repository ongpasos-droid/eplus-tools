require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./node/src/routes/auth');
const projectRoutes = require('./node/src/routes/projects');
const partnerRoutes = require('./node/src/routes/partners');
const intakeProgramRoutes = require('./node/src/routes/intake-programs');
const apiPublicRoutes = require('./node/src/routes/api-public');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Lock down in production
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Static files (frontend) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes (v1) ---
app.use('/v1/auth', authRoutes);
app.use('/v1/projects', projectRoutes);
app.use('/v1/partners', partnerRoutes);
app.use('/v1/intake-programs', intakeProgramRoutes);

// --- Public API (frontend, no auth) ---
app.use('/api/projects', apiPublicRoutes);

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'intake', version: '1.0.0' });
});

// --- 404 for unknown API routes ---
app.use('/v1/*', (req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint not found' });
});

// --- Global error handler ---
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Intake API running on port ${PORT}`);
});
