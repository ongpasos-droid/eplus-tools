-- ============================================================
-- Migration 001: Core tables for E+ Tools
-- Database: eplus_tools
-- Date: 2026-04-03
-- ============================================================

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id                  CHAR(36) NOT NULL PRIMARY KEY,
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       VARCHAR(255) NOT NULL,
  name                VARCHAR(150) NOT NULL,
  role                ENUM('admin','user','writer') NOT NULL DEFAULT 'user',
  subscription        ENUM('free','premium') NOT NULL DEFAULT 'free',
  email_verified      TINYINT(1) NOT NULL DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT NOW(),
  updated_at          DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_subscription ON users(subscription);

-- 2. projects
CREATE TABLE IF NOT EXISTS projects (
  id                  CHAR(36) NOT NULL PRIMARY KEY,
  user_id             CHAR(36) NOT NULL,
  name                VARCHAR(100) NOT NULL,
  type                VARCHAR(60) NOT NULL,
  description         TEXT,
  start_date          DATE NOT NULL,
  duration_months     INT NOT NULL,
  deadline            DATE,
  eu_grant            DECIMAL(12,2) NOT NULL,
  cofin_pct           INT NOT NULL,
  indirect_pct        DECIMAL(5,2) NOT NULL,
  status              ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
  created_at          DATETIME NOT NULL DEFAULT NOW(),
  updated_at          DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(type);

-- 3. partners
CREATE TABLE IF NOT EXISTS partners (
  id                  CHAR(36) NOT NULL PRIMARY KEY,
  project_id          CHAR(36) NOT NULL,
  name                VARCHAR(100) NOT NULL,
  legal_name          VARCHAR(200),
  city                VARCHAR(100),
  country             VARCHAR(100) NOT NULL,
  role                ENUM('applicant','partner') NOT NULL,
  order_index         INT NOT NULL,

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_partners_project ON partners(project_id);
CREATE INDEX idx_partners_role ON partners(role);
