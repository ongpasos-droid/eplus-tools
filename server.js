/* ═══════════════════════════════════════════════════════════════
   E+ Tools — Express Server (Entry Point)
   Single process, all modules under /v1/{module}/
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const path         = require('path');
const cookieParser = require('cookie-parser');

const authRoutes           = require('./node/src/routes/auth');
const projectRoutes        = require('./node/src/routes/projects');
const partnerRoutes        = require('./node/src/routes/partners');
const intakeProgramRoutes  = require('./node/src/routes/intake-programs');
const apiPublicRoutes      = require('./node/src/routes/api-public');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Security ─────────────────────────────────────────────────── */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://accounts.google.com", "https://apis.google.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "https:"],
      connectSrc:  ["'self'", "https://accounts.google.com"],
      frameSrc:    ["https://accounts.google.com"],
    }
  }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

/* ── Body parsing ─────────────────────────────────────────────── */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

/* ── Static files (SPA) ──────────────────────────────────────── */
app.use(express.static(path.join(__dirname, 'public')));

/* ── API Routes (v1) ──────────────────────────────────────────── */
app.use('/v1/auth',             authRoutes);
app.use('/v1/projects',         projectRoutes);
app.use('/v1/partners',         partnerRoutes);
app.use('/v1/intake-programs',  intakeProgramRoutes);
app.use('/api/projects',        apiPublicRoutes);

/* ── Health check ─────────────────────────────────────────────── */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', module: 'eplus-tools', version: '0.2.0' });
});

/* ── 404 for unknown API routes ───────────────────────────────── */
app.use('/v1/*', (_req, res) => {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

/* ── SPA fallback — serve index.html for all non-API routes ─── */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ── Global error handler ─────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    ok: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : err.message
    }
  });
});

/* ── Start ────────────────────────────────────────────────────── */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[E+ Tools] Server running on port ${PORT}`);
});
