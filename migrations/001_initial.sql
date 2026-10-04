CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, idea TEXT NOT NULL, context TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checklist_versions (
  version INTEGER PRIMARY KEY AUTOINCREMENT, controls TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL, checklist_version INTEGER NOT NULL REFERENCES checklist_versions(version));
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed','cancelled')),
  created_at TEXT NOT NULL, error TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE, draft TEXT NOT NULL,
  provider TEXT NOT NULL, model TEXT NOT NULL, mode TEXT NOT NULL, tool TEXT NOT NULL,
  template_version TEXT NOT NULL, checklist_version INTEGER NOT NULL REFERENCES checklist_versions(version),
  created_at TEXT NOT NULL, rating INTEGER CHECK(rating BETWEEN 1 AND 5), correction TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS examples (
  id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_updated ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS messages_project ON messages(project_id,created_at);
CREATE INDEX IF NOT EXISTS versions_project ON versions(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS examples_project ON examples(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_run ON runs(project_id) WHERE status='pending';
