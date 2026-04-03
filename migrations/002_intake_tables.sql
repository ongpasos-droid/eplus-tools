-- ============================================================
-- Migration 002: Intake module tables (M0)
-- Database: eplus_tools
-- Date: 2026-04-03
-- ============================================================

-- 19. intake_programs (reference table — no FK to projects)
CREATE TABLE IF NOT EXISTS intake_programs (
  id                  CHAR(36) NOT NULL PRIMARY KEY,
  program_id          VARCHAR(60) NOT NULL UNIQUE,
  name                VARCHAR(200) NOT NULL,
  action_type         VARCHAR(60) NOT NULL,
  deadline            DATE,
  start_date_min      DATE,
  start_date_max      DATE,
  duration_min_months INT,
  duration_max_months INT,
  eu_grant_max        DECIMAL(12,2),
  cofin_pct           INT,
  indirect_pct        DECIMAL(5,2),
  min_partners        INT NOT NULL DEFAULT 2,
  notes               TEXT,
  active              TINYINT(1) NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. intake_contexts
CREATE TABLE IF NOT EXISTS intake_contexts (
  id                  CHAR(36) NOT NULL PRIMARY KEY,
  project_id          CHAR(36) NOT NULL,
  problem             TEXT,
  target_groups       TEXT,
  approach            TEXT,
  created_at          DATETIME NOT NULL DEFAULT NOW(),
  updated_at          DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE UNIQUE INDEX idx_intake_ctx_project ON intake_contexts(project_id);

-- ============================================================
-- Seed data: KA3 Youth Together 2026
-- ============================================================
INSERT INTO intake_programs (id, program_id, name, action_type, deadline,
  start_date_min, start_date_max, duration_min_months, duration_max_months,
  eu_grant_max, cofin_pct, indirect_pct, min_partners, active)
VALUES (
  UUID(), 'ka3_youth_together_2026', 'KA3 Youth Together — European Youth Together 2026',
  'KA3-Youth', '2026-03-15', '2026-09-01', '2027-03-01',
  12, 24, 500000.00, 80, 7.00, 2, 1
);
