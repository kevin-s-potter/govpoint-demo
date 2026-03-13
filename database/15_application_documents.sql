-- ============================================================
-- LexiPoint Migration 15 — Application Documents Table
-- Supports document upload + AI classification in childcare.html
--
-- Also requires a Supabase Storage bucket named "childcare-documents"
-- (public, allow PDF/JPEG/PNG/WEBP, 10MB max) — create via dashboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS application_documents (
  doc_id            TEXT PRIMARY KEY,
  program_id        TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,
  session_id        TEXT NOT NULL,         -- random UUID per intake session (sessionStorage)
  file_name         TEXT NOT NULL,
  file_url          TEXT NOT NULL,         -- Supabase Storage public URL
  file_size         INTEGER,
  mime_type         TEXT,
  classification    TEXT NOT NULL,         -- user-selected classification key
  ai_classification TEXT,                  -- Claude's best-guess classification label
  ai_confidence     DECIMAL(5,2),         -- 0–100: confidence user's classification is correct
  ai_summary        TEXT,                  -- 1–2 sentence document summary from Claude
  status            TEXT DEFAULT 'uploaded', -- uploaded | processing | classified | error
  uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
  processed_at      TIMESTAMPTZ
);

-- RLS: anon can insert and read documents (demo only — no user auth)
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_docs"
  ON application_documents FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_docs"
  ON application_documents FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_docs"
  ON application_documents FOR UPDATE TO anon USING (true);

-- Audit entry
INSERT INTO audit_log (audit_id, tenant_id, user_id, role, action, target_type, target_id, detail, timestamp)
VALUES (
  'aud-migration-15', 'ohio-odjfs', 'user-301', 'publisher', 'schema_change', 'table', 'application_documents',
  'Migration 15: created application_documents table for child care document upload + AI classification', NOW()
);
