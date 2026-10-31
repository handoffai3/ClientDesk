-- ============================================================
-- ClientDesk — full schema for a fresh Supabase project
-- Run this once in the Supabase SQL Editor (or via psql).
-- ============================================================

-- AGENCIES (the main account / white-label owner)
CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#7C3AED',
  custom_domain text,
  email text NOT NULL UNIQUE,
  stripe_account_id text,
  stripe_connected boolean DEFAULT false,
  email_notifications_enabled boolean DEFAULT true,
  reply_to_email text,
  currency text DEFAULT 'USD',
  tax_label text DEFAULT 'Tax',
  default_tax_rate numeric(5,2) DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- USERS (agency staff members)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  full_name text,
  email text NOT NULL UNIQUE,
  avatar_url text,
  role text CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  created_at timestamp DEFAULT now()
);

-- CLIENTS
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  company text,
  email text NOT NULL,
  phone text,
  location text,
  avatar_url text,
  status text CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at timestamp DEFAULT now()
);

-- CLIENT AUTH (client portal login)
CREATE TABLE client_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  created_at timestamp DEFAULT now()
);

-- PROJECTS
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text CHECK (status IN ('active', 'completed', 'on_hold')) DEFAULT 'active',
  progress int DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  deadline date,
  created_at timestamp DEFAULT now()
);

-- TIMELINE UPDATES
CREATE TABLE timeline_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  posted_by uuid REFERENCES users(id),
  content text NOT NULL,
  status text CHECK (status IN ('completed', 'in_progress', 'pending')) DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);

-- TASKS (kanban)
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  category text,
  status text CHECK (status IN ('today', 'this_week', 'done')) DEFAULT 'today',
  assigned_to uuid REFERENCES users(id),
  visible_to_client boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- FILES
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_path text,
  file_size bigint,
  file_type text,
  folder text CHECK (folder IN ('designs', 'contracts', 'invoices', 'reports', 'brand_assets', 'client_uploads')) DEFAULT 'designs',
  is_locked boolean DEFAULT false,
  unlock_type text CHECK (unlock_type IN ('approval', 'payment')),
  unlock_invoice_id uuid,
  unlocked_at timestamptz,
  created_at timestamp DEFAULT now()
);

-- INVOICES
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  status text CHECK (status IN ('draft', 'sent', 'paid', 'pending', 'overdue')) DEFAULT 'draft',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  gst_rate numeric(5,2) DEFAULT 18,
  gst_amount numeric(10,2) DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  issue_date date DEFAULT current_date,
  due_date date,
  notes text,
  stripe_session_id text,
  paid_at timestamptz,
  created_at timestamp DEFAULT now()
);

-- Add FK after invoices table exists
ALTER TABLE files ADD CONSTRAINT files_unlock_invoice_fkey
  FOREIGN KEY (unlock_invoice_id) REFERENCES invoices(id);

-- INVOICE LINE ITEMS
CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) DEFAULT 1,
  rate numeric(10,2) DEFAULT 0,
  amount numeric(10,2) DEFAULT 0
);

-- APPROVALS
CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image_url text,
  status text CHECK (status IN ('pending', 'approved', 'changes_requested')) DEFAULT 'pending',
  reviewed_at timestamp,
  created_at timestamp DEFAULT now()
);

-- MILESTONES
CREATE TABLE milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  is_completed boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- MESSAGES
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  sender_type text CHECK (sender_type IN ('agency', 'client')) NOT NULL,
  sender_id uuid NOT NULL,
  content text,
  file_url text,
  file_name text,
  is_read boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- ACTIVITY LOG
CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  actor_id uuid,
  actor_type text CHECK (actor_type IN ('agency', 'client')),
  action text NOT NULL,
  created_at timestamp DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean DEFAULT false,
  type text CHECK (type IN ('invoice', 'file', 'approval', 'message', 'task')),
  created_at timestamp DEFAULT now()
);

-- DELIVERABLES (visual proofing)
CREATE TABLE deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_path text,
  file_type text NOT NULL,
  thumbnail_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'changes_requested', 'approved')),
  version integer DEFAULT 1,
  approved_at timestamptz,
  approved_by uuid,
  approved_ip text,
  approved_user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- PINS (coordinates on deliverables)
CREATE TABLE pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid REFERENCES deliverables(id) ON DELETE CASCADE NOT NULL,
  author_id uuid NOT NULL,
  author_type text NOT NULL CHECK (author_type IN ('agency', 'client')),
  author_name text NOT NULL,
  x_percent numeric NOT NULL,
  y_percent numeric NOT NULL,
  page_number integer DEFAULT 1,
  content text NOT NULL,
  is_resolved boolean DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- PIN REPLIES
CREATE TABLE pin_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id uuid REFERENCES pins(id) ON DELETE CASCADE NOT NULL,
  author_id uuid NOT NULL,
  author_type text NOT NULL CHECK (author_type IN ('agency', 'client')),
  author_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- AI USAGE (rate limiting)
CREATE TABLE ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_clients_agency ON clients(agency_id);
CREATE INDEX idx_projects_agency ON projects(agency_id);
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_invoices_agency ON invoices(agency_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_files_agency ON files(agency_id);
CREATE INDEX idx_files_project ON files(project_id);
CREATE INDEX idx_messages_client ON messages(client_id);
CREATE INDEX idx_activity_logs_agency ON activity_logs(agency_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_deliverables_project ON deliverables(project_id);
CREATE INDEX idx_pins_deliverable ON pins(deliverable_id);
CREATE INDEX idx_pin_replies_pin ON pin_replies(pin_id);
CREATE INDEX idx_ai_usage_agency_created ON ai_usage(agency_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_agency_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agency_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_client_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM client_users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_client_agency_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.agency_id FROM client_users cu JOIN clients c ON c.id = cu.client_id WHERE cu.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_agency_id(), public.current_user_role(), public.current_client_ids(), public.current_client_agency_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.current_agency_id(), public.current_user_role(), public.current_client_ids(), public.current_client_agency_ids() TO anon, authenticated, service_role;

-- Public branding for the client login page (no auth required)
CREATE OR REPLACE FUNCTION public.get_agency_branding(p_agency_id uuid)
RETURNS TABLE(name text, logo_url text, primary_color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.name, a.logo_url, a.primary_color FROM agencies a WHERE a.id = p_agency_id
$$;
REVOKE ALL ON FUNCTION public.get_agency_branding(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_agency_branding(uuid) TO anon, authenticated, service_role;

-- Stripe fields helper (prevents recursion in agency_update policy)
CREATE OR REPLACE FUNCTION public.current_agency_stripe()
RETURNS TABLE(stripe_account_id text, stripe_connected boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.stripe_account_id, a.stripe_connected
  FROM agencies a WHERE a.id = (SELECT agency_id FROM users WHERE id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.current_agency_stripe() FROM public;
GRANT EXECUTE ON FUNCTION public.current_agency_stripe() TO anon, authenticated, service_role;

-- ============================================================
-- RLS POLICIES — AGENCIES
-- ============================================================
CREATE POLICY "agencies_select_scoped" ON agencies FOR SELECT
  USING (id = public.current_agency_id() OR id IN (SELECT public.current_client_agency_ids()));

CREATE POLICY "agency_update_admin" ON agencies FOR UPDATE
  USING (id = public.current_agency_id() AND public.current_user_role() = 'admin')
  WITH CHECK (
    id = public.current_agency_id()
    AND public.current_user_role() = 'admin'
    AND stripe_account_id IS NOT DISTINCT FROM (SELECT s.stripe_account_id FROM public.current_agency_stripe() s)
    AND stripe_connected IS NOT DISTINCT FROM (SELECT s.stripe_connected FROM public.current_agency_stripe() s)
  );

-- ============================================================
-- RLS POLICIES — USERS
-- ============================================================
CREATE POLICY "users_select_scoped" ON users FOR SELECT
  USING (id = auth.uid() OR agency_id = public.current_agency_id() OR agency_id IN (SELECT public.current_client_agency_ids()));

CREATE POLICY "users_update_self" ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid()
    AND agency_id IS NOT DISTINCT FROM public.current_agency_id()
    AND role IS NOT DISTINCT FROM public.current_user_role());

-- ============================================================
-- RLS POLICIES — CLIENTS
-- ============================================================
CREATE POLICY "agency_own_data" ON clients
  FOR ALL USING (agency_id = public.current_agency_id());

CREATE POLICY "client_own_client" ON clients FOR SELECT
  USING (id IN (SELECT public.current_client_ids()));

-- ============================================================
-- RLS POLICIES — CLIENT_USERS
-- ============================================================
CREATE POLICY "client_users_select" ON client_users FOR SELECT
  USING (id = auth.uid() OR client_id IN (
    SELECT id FROM clients WHERE agency_id = public.current_agency_id()
  ));

-- ============================================================
-- RLS POLICIES — PROJECTS
-- ============================================================
CREATE POLICY "agency_own_projects" ON projects
  FOR ALL USING (agency_id = public.current_agency_id());

CREATE POLICY "client_own_projects" ON projects FOR SELECT
  USING (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()));

-- ============================================================
-- RLS POLICIES — TIMELINE UPDATES
-- ============================================================
CREATE POLICY "agency_own_timeline" ON timeline_updates
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE agency_id = public.current_agency_id()));

CREATE POLICY "client_own_timeline" ON timeline_updates FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

-- ============================================================
-- RLS POLICIES — TASKS
-- ============================================================
CREATE POLICY "agency_own_tasks" ON tasks FOR ALL
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

CREATE POLICY "client_view_tasks" ON tasks FOR SELECT
  USING (
    visible_to_client = true
    AND project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()))
  );

-- ============================================================
-- RLS POLICIES — FILES
-- ============================================================
CREATE POLICY "agency_own_files" ON files FOR ALL
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

CREATE POLICY "client_own_files" ON files FOR SELECT
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    OR project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()))
  );

CREATE POLICY "client_insert_files" ON files FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND folder = 'client_uploads'
    AND is_locked = false
    AND client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    AND project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()))
    AND agency_id = (SELECT agency_id FROM projects WHERE id = project_id)
  );

-- ============================================================
-- RLS POLICIES — INVOICES
-- ============================================================
CREATE POLICY "agency_own_invoices" ON invoices
  FOR ALL USING (agency_id = public.current_agency_id());

CREATE POLICY "client_own_invoices" ON invoices FOR SELECT
  USING (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()));

-- ============================================================
-- RLS POLICIES — INVOICE ITEMS
-- ============================================================
CREATE POLICY "agency_own_invoice_items" ON invoice_items
  FOR ALL USING (invoice_id IN (SELECT id FROM invoices WHERE agency_id = public.current_agency_id()));

CREATE POLICY "client_own_invoice_items" ON invoice_items FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

-- ============================================================
-- RLS POLICIES — APPROVALS
-- ============================================================
CREATE POLICY "agency_own_approvals" ON approvals
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE agency_id = public.current_agency_id()));

CREATE POLICY "client_own_approvals" ON approvals FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

CREATE POLICY "client_update_approvals" ON approvals FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

-- ============================================================
-- RLS POLICIES — MILESTONES
-- ============================================================
CREATE POLICY "agency_own_milestones" ON milestones
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE agency_id = public.current_agency_id()));

CREATE POLICY "client_own_milestones" ON milestones FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

-- ============================================================
-- RLS POLICIES — MESSAGES
-- ============================================================
CREATE POLICY "agency_own_messages" ON messages FOR ALL
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

CREATE POLICY "client_select_messages" ON messages FOR SELECT
  USING (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()));

CREATE POLICY "client_insert_messages" ON messages FOR INSERT
  WITH CHECK (
    sender_type = 'client'
    AND sender_id = auth.uid()
    AND client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    AND agency_id = (SELECT agency_id FROM clients WHERE id = client_id)
    AND (project_id IS NULL OR project_id IN (SELECT id FROM projects WHERE client_id = messages.client_id))
  );

CREATE POLICY "client_update_messages" ON messages FOR UPDATE
  USING (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()))
  WITH CHECK (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()));

-- ============================================================
-- RLS POLICIES — ACTIVITY LOGS
-- ============================================================
CREATE POLICY "agency_own_activity_logs" ON activity_logs
  FOR ALL USING (agency_id = public.current_agency_id());

-- ============================================================
-- RLS POLICIES — NOTIFICATIONS
-- ============================================================
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "notifications_cross_insert" ON notifications FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE agency_id = public.current_agency_id())
    OR user_id IN (SELECT cu.id FROM client_users cu JOIN clients c ON c.id = cu.client_id
                   WHERE c.agency_id = public.current_agency_id())
    OR user_id IN (SELECT id FROM users WHERE agency_id IN (SELECT public.current_client_agency_ids()))
  );

-- ============================================================
-- RLS POLICIES — DELIVERABLES
-- ============================================================
CREATE POLICY "agency_deliverables" ON deliverables FOR ALL
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

CREATE POLICY "client_deliverables" ON deliverables FOR SELECT
  USING (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()));

CREATE POLICY "client_update_deliverables" ON deliverables FOR UPDATE
  USING (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()))
  WITH CHECK (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()));

-- ============================================================
-- RLS POLICIES — PINS
-- ============================================================
CREATE POLICY "agency_pins" ON pins FOR ALL
  USING (deliverable_id IN (SELECT id FROM deliverables WHERE agency_id = public.current_agency_id()));

CREATE POLICY "client_pins" ON pins FOR ALL
  USING (deliverable_id IN (SELECT id FROM deliverables WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

-- ============================================================
-- RLS POLICIES — PIN REPLIES
-- ============================================================
CREATE POLICY "agency_pin_replies" ON pin_replies FOR ALL
  USING (pin_id IN (SELECT id FROM pins WHERE deliverable_id IN (
    SELECT id FROM deliverables WHERE agency_id = public.current_agency_id())));

CREATE POLICY "client_pin_replies" ON pin_replies FOR ALL
  USING (pin_id IN (SELECT id FROM pins WHERE deliverable_id IN (
    SELECT id FROM deliverables WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()))));

-- ============================================================
-- STORAGE BUCKET POLICIES
-- ============================================================
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ClientDeskBucket');

CREATE POLICY "Allow authenticated select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ClientDeskBucket');

-- Branding bucket (public — logos must be viewable by anonymous visitors)
CREATE POLICY "branding_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'branding');

CREATE POLICY "branding_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding');

CREATE POLICY "branding_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'branding');

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Enforce that only client users may approve/request-changes on deliverables
CREATE OR REPLACE FUNCTION public.enforce_deliverable_approval_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status)
     AND NEW.status IN ('approved', 'changes_requested')
     AND NOT EXISTS (SELECT 1 FROM client_users WHERE id = auth.uid() AND client_id = OLD.client_id)
  THEN
    RAISE EXCEPTION 'Only client users may approve or request changes on deliverables';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deliverable_approval_role
  BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION enforce_deliverable_approval_role();

-- Approval unlock: clients cannot UPDATE files directly, so unlocking goes through this function
CREATE OR REPLACE FUNCTION unlock_approval_files(p_project_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects p JOIN client_users cu ON cu.client_id = p.client_id WHERE p.id = p_project_id AND cu.id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM projects p JOIN users u ON u.agency_id = p.agency_id WHERE p.id = p_project_id AND u.id = auth.uid())
  THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM deliverables WHERE project_id = p_project_id AND status = 'approved') THEN
    RAISE EXCEPTION 'no approved deliverable on this project';
  END IF;
  UPDATE files SET unlocked_at = now()
   WHERE project_id = p_project_id AND is_locked = true AND unlock_type = 'approval' AND unlocked_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION unlock_approval_files(uuid) FROM public;
GRANT EXECUTE ON FUNCTION unlock_approval_files(uuid) TO authenticated;

-- AI rate limiter: count calls in the last hour, refuse at p_limit, otherwise record one
CREATE OR REPLACE FUNCTION consume_ai_quota(p_agency_id uuid, p_limit int DEFAULT 10)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_agency_id::text));
  DELETE FROM ai_usage WHERE agency_id = p_agency_id AND created_at < now() - interval '1 day';
  SELECT count(*) INTO used FROM ai_usage WHERE agency_id = p_agency_id AND created_at > now() - interval '1 hour';
  IF used >= p_limit THEN RETURN false; END IF;
  INSERT INTO ai_usage (agency_id) VALUES (p_agency_id);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION consume_ai_quota(uuid, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_ai_quota(uuid, int) TO service_role;

-- ============================================================
-- REALTIME
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages','tasks','files','pins','pin_replies','notifications'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
