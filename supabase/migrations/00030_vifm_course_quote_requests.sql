-- ============================================================
-- 00030 — Customer-facing course catalogue: quote requests
-- ============================================================
-- Adds the lead-capture half of the public training-catalogue flow.
-- Anyone (typically a prospective client browsing /courses) can
-- submit a quote request for a specific course; VIFM admins see
-- the queue at /admin/courses/quotes and progress each lead through
-- new → contacted → quoted → won / lost.
--
-- Schema notes:
--
--   - course_id ON DELETE SET NULL: we keep the request record even
--     if a course is later removed from the catalogue, because the
--     historical lead still has commercial value.
--   - status enum is enforced via CHECK rather than a Postgres enum
--     type so adding new states later is a single ALTER instead of
--     a schema migration.
--   - assigned_to is the VIFM staffer who claimed the lead.
--   - ip_address / user_agent are captured for anti-abuse only —
--     do not surface them in the admin UI by default; treat as PII.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- CREATE POLICY follows DROP POLICY IF EXISTS (Postgres lacks
-- CREATE POLICY IF NOT EXISTS until very recent versions).
-- ============================================================

CREATE TABLE IF NOT EXISTS vifm_course_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The course this quote is about. SET NULL on course delete so the
  -- audit trail survives catalogue rationalisation.
  course_id uuid REFERENCES vifm_courses(id) ON DELETE SET NULL,
  -- Snapshot the course code at submission time so the admin UI can
  -- show what was originally requested even if course_id is later null.
  course_code_snapshot text,
  course_title_snapshot text,

  -- Requester identity (always required at submission)
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_company text NOT NULL,
  requester_phone text,
  requester_role text,

  -- Quote scope (optional — better to capture if provided)
  estimated_group_size int CHECK (estimated_group_size IS NULL OR estimated_group_size > 0),
  preferred_start_date date,
  preferred_language text CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'ar', 'bilingual')),
  delivery_mode text CHECK (delivery_mode IS NULL OR delivery_mode IN ('in_person', 'virtual', 'hybrid')),
  notes text,

  -- Workflow / sales pipeline
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'quoted', 'won', 'lost')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  internal_notes text,
  contacted_at timestamptz,
  quoted_at timestamptz,
  closed_at timestamptz,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Anti-abuse / forensic-only
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS vifm_course_quote_requests_status_idx
  ON vifm_course_quote_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS vifm_course_quote_requests_course_idx
  ON vifm_course_quote_requests (course_id);
CREATE INDEX IF NOT EXISTS vifm_course_quote_requests_assigned_idx
  ON vifm_course_quote_requests (assigned_to)
  WHERE assigned_to IS NOT NULL;

-- updated_at trigger so admin status changes carry an audit timestamp.
CREATE OR REPLACE FUNCTION vifm_course_quote_requests_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vifm_course_quote_requests_set_updated_at ON vifm_course_quote_requests;
CREATE TRIGGER vifm_course_quote_requests_set_updated_at
  BEFORE UPDATE ON vifm_course_quote_requests
  FOR EACH ROW EXECUTE FUNCTION vifm_course_quote_requests_set_updated_at();

ALTER TABLE vifm_course_quote_requests ENABLE ROW LEVEL SECURITY;

-- Public INSERT: anyone (anon role included) can submit a quote
-- request from the public /courses/[code]/request-quote page. The
-- form posts via a server action which uses the service-role client
-- internally — but the policy keeps the door open for a future
-- direct-from-browser flow if that's ever wanted.
DROP POLICY IF EXISTS quote_requests_public_insert ON vifm_course_quote_requests;
CREATE POLICY quote_requests_public_insert ON vifm_course_quote_requests
  FOR INSERT WITH CHECK (true);

-- Admin SELECT: only VIFM admin role can read the queue.
DROP POLICY IF EXISTS quote_requests_admin_select ON vifm_course_quote_requests;
CREATE POLICY quote_requests_admin_select ON vifm_course_quote_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin UPDATE: only VIFM admin role can change status / assign / write internal notes.
DROP POLICY IF EXISTS quote_requests_admin_update ON vifm_course_quote_requests;
CREATE POLICY quote_requests_admin_update ON vifm_course_quote_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- No DELETE policy on purpose — quote-request history is commercial
-- record-keeping, not user data the requester owns. If purging is
-- ever needed, do it via service-role from an admin tool.

COMMENT ON TABLE vifm_course_quote_requests IS
  'Lead-capture queue for the public /courses catalogue. Anonymous INSERT, admin-only SELECT/UPDATE. See src/lib/courses/quote-request-actions.ts for the server actions.';
