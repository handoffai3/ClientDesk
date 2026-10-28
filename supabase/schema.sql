-- AGENCIES (the main account / white-label owner)
create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text default '#7C3AED',
  custom_domain text,
  email text not null unique,
  stripe_account_id text,
  stripe_connected boolean default false,
  email_notifications_enabled boolean default true,
  reply_to_email text,
  created_at timestamp default now()
);

-- USERS (agency staff members)
create table users (
  id uuid primary key references auth.users(id),
  agency_id uuid references agencies(id) on delete cascade,
  full_name text,
  email text not null unique,
  avatar_url text,
  role text check (role in ('admin', 'member')) default 'member',
  created_at timestamp default now()
);

-- CLIENTS
create table clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete cascade,
  full_name text not null,
  company text,
  email text not null,
  phone text,
  location text,
  avatar_url text,
  status text check (status in ('active', 'inactive')) default 'active',
  created_at timestamp default now()
);

-- CLIENT AUTH (client portal login)
create table client_users (
  id uuid primary key references auth.users(id),
  client_id uuid references clients(id) on delete cascade,
  email text not null unique,
  created_at timestamp default now()
);

-- PROJECTS
create table projects (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  name text not null,
  description text,
  status text check (status in ('active', 'completed', 'on_hold')) default 'active',
  progress int default 0 check (progress >= 0 and progress <= 100),
  deadline date,
  created_at timestamp default now()
);

-- TIMELINE UPDATES
create table timeline_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  posted_by uuid references users(id),
  content text not null,
  status text check (status in ('completed', 'in_progress', 'pending')) default 'pending',
  created_at timestamp default now()
);

-- TASKS (kanban)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  agency_id uuid references agencies(id) on delete cascade,
  title text not null,
  description text,
  priority text check (priority in ('high', 'medium', 'low')) default 'medium',
  category text,
  status text check (status in ('today', 'this_week', 'done')) default 'today',
  assigned_to uuid references users(id),
  visible_to_client boolean default false,
  created_at timestamp default now()
);

-- FILES
create table files (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  uploaded_by uuid references users(id),
  file_name text not null,
  file_url text not null,
  file_size bigint,
  file_type text,
  folder text check (folder in ('designs', 'contracts', 'invoices', 'reports', 'brand_assets')) default 'designs',
  is_locked boolean default false,
  unlock_type text check (unlock_type in ('approval', 'payment')),
  unlock_invoice_id uuid references invoices(id),
  unlocked_at timestamptz,
  created_at timestamp default now()
);

-- INVOICES
create table invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  invoice_number text not null unique,
  status text check (status in ('draft', 'sent', 'paid', 'pending', 'overdue')) default 'draft',
  subtotal numeric(10,2) not null default 0,
  gst_rate numeric(5,2) default 18,
  gst_amount numeric(10,2) default 0,
  total numeric(10,2) not null default 0,
  issue_date date default current_date,
  due_date date,
  notes text,
  stripe_session_id text,
  paid_at timestamptz,
  created_at timestamp default now()
);

-- INVOICE LINE ITEMS
create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) default 1,
  rate numeric(10,2) default 0,
  amount numeric(10,2) default 0
);

-- APPROVALS
create table approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  status text check (status in ('pending', 'approved', 'changes_requested')) default 'pending',
  reviewed_at timestamp,
  created_at timestamp default now()
);

-- MILESTONES
create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  is_completed boolean default false,
  created_at timestamp default now()
);

-- MESSAGES
create table messages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  sender_type text check (sender_type in ('agency', 'client')) not null,
  sender_id uuid not null,
  content text,
  file_url text,
  file_name text,
  is_read boolean default false,
  created_at timestamp default now()
);

-- ACTIVITY LOG
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  actor_id uuid,
  actor_type text check (actor_type in ('agency', 'client')),
  action text not null,
  created_at timestamp default now()
);

-- NOTIFICATIONS
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean default false,
  type text check (type in ('invoice', 'file', 'approval', 'message', 'task')),
  created_at timestamp default now()
);

-- RLS (Row Level Security)
alter table agencies enable row level security;
alter table users enable row level security;
alter table clients enable row level security;
alter table client_users enable row level security;
alter table projects enable row level security;
alter table timeline_updates enable row level security;
alter table tasks enable row level security;
alter table files enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table approvals enable row level security;
alter table milestones enable row level security;
alter table messages enable row level security;
alter table activity_logs enable row level security;
alter table notifications enable row level security;

-- BASIC RLS POLICIES (agency sees own data only)
create policy "agency_own_data" on clients
  for all using (agency_id = (
    select agency_id from users where id = auth.uid()
  ));

create policy "agency_own_projects" on projects
  for all using (agency_id = (
    select agency_id from users where id = auth.uid()
  ));

create policy "agency_own_invoices" on invoices
  for all using (agency_id = (
    select agency_id from users where id = auth.uid()
  ));

create policy "agency_own_files" on files
  for all using (agency_id = (
    select agency_id from users where id = auth.uid()
  ));

create policy "agency_own_messages" on messages
  for all using (agency_id = (
    select agency_id from users where id = auth.uid()
  ));

-- INDEXES for performance
create index on clients(agency_id);
create index on projects(agency_id);
create index on projects(client_id);
create index on invoices(agency_id);
create index on invoices(client_id);
create index on files(agency_id);
create index on files(project_id);
create index on messages(client_id);
create index on activity_logs(agency_id);
create index on tasks(project_id);

-- ADDITIONAL RLS POLICIES FOR SECURITY AND FUNCTIONALITY

-- Agencies table policies
-- SELECT kept open because client login page fetches agency branding pre-auth.
-- (superseded: see 'Tightened agencies/users/notifications policies' at the end of this file: agency_select)

-- (superseded: see 'Tightened agencies/users/notifications policies' at the end of this file: agency_update_admin)

-- (superseded: see 'Tightened agencies/users/notifications policies' at the end of this file: agency_insert)

-- Users table policies
-- (superseded: see 'Tightened agencies/users/notifications policies' at the end of this file: users_select)

-- (superseded: see 'Tightened agencies/users/notifications policies' at the end of this file: users_insert)

-- (superseded: see 'Tightened agencies/users/notifications policies' at the end of this file: users_update)

-- Timeline Updates table policies
create policy "agency_own_timeline" on timeline_updates
  for all using (project_id in (
    select id from projects where agency_id = (
      select agency_id from users where id = auth.uid()
    )
  ));

-- Tasks table policies
create policy "agency_own_tasks" on tasks
  for all using (agency_id = (
    select agency_id from users where id = auth.uid()
  ));

-- Approvals table policies
create policy "agency_own_approvals" on approvals
  for all using (project_id in (
    select id from projects where agency_id = (
      select agency_id from users where id = auth.uid()
    )
  ));

-- Milestones table policies
create policy "agency_own_milestones" on milestones
  for all using (project_id in (
    select id from projects where agency_id = (
      select agency_id from users where id = auth.uid()
    )
  ));

-- Client users: own row access
create policy "client_users_select" on client_users
  for select using (id = auth.uid() or client_id in (
    select id from clients where agency_id = (select agency_id from users where id = auth.uid())
  ));

-- No INSERT policy on client_users on purpose: portal logins are created server-side (service role) by /api/client/invite.
-- (The previous 'with check (true)' policy let anyone link themselves to any client.)

-- Client user access to projects (via client_id → clients → agency_id)
create policy "client_own_projects" on projects
  for select using (client_id in (
    select client_id from client_users where id = auth.uid()
  ));

-- Client user access to files (via project → client_id)
create policy "client_own_files" on files
  for select using (project_id in (
    select id from projects where client_id in (
      select client_id from client_users where id = auth.uid()
    )
  ));

-- Client user access to invoices
create policy "client_own_invoices" on invoices
  for select using (client_id in (
    select client_id from client_users where id = auth.uid()
  ));

-- Client user access to messages
create policy "client_own_messages" on messages
  for all using (client_id in (
    select client_id from client_users where id = auth.uid()
  ));

-- Notifications: user sees own notifications
-- (superseded: see 'Tightened agencies/users/notifications policies' at the end of this file: own_notifications)

-- Activity logs: agency sees own
create policy "agency_own_activity_logs" on activity_logs
  for all using (agency_id = (
    select agency_id from users where id = auth.uid()
  ));

-- Invoice items: accessible via invoice ownership
create policy "agency_own_invoice_items" on invoice_items
  for all using (invoice_id in (
    select id from invoices where agency_id = (
      select agency_id from users where id = auth.uid()
    )
  ));

create policy "client_own_invoice_items" on invoice_items
  for select using (invoice_id in (
    select id from invoices where client_id in (
      select client_id from client_users where id = auth.uid()
    )
  ));

-- DELIVERABLES (visual proofing)
create table deliverables (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  client_id uuid references clients(id) on delete set null,
  title text not null,
  description text,
  file_url text not null,
  file_type text not null,
  thumbnail_url text,
  status text default 'pending' check (status in ('pending', 'in_review', 'changes_requested', 'approved')),
  version integer default 1,
  approved_at timestamptz,
  approved_by uuid,
  approved_ip text,
  approved_user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PINS (coordinates on deliverables)
create table pins (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid references deliverables(id) on delete cascade not null,
  author_id uuid not null,
  author_type text not null check (author_type in ('agency', 'client')),
  author_name text not null,
  x_percent numeric not null,
  y_percent numeric not null,
  page_number integer default 1,
  content text not null,
  is_resolved boolean default false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- PIN REPLIES
create table pin_replies (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid references pins(id) on delete cascade not null,
  author_id uuid not null,
  author_type text not null check (author_type in ('agency', 'client')),
  author_name text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table deliverables enable row level security;
alter table pins enable row level security;
alter table pin_replies enable row level security;

-- Agency policies for deliverables
create policy "agency_deliverables" on deliverables
  for all using (agency_id in (select agency_id from users where id = auth.uid()));

create policy "agency_pins" on pins
  for all using (deliverable_id in (
    select id from deliverables where agency_id in (select agency_id from users where id = auth.uid())
  ));

create policy "agency_pin_replies" on pin_replies
  for all using (pin_id in (
    select id from pins where deliverable_id in (
      select id from deliverables where agency_id in (select agency_id from users where id = auth.uid())
    )
  ));

-- Client policies for deliverables
create policy "client_deliverables" on deliverables
  for select using (client_id in (select client_id from client_users where id = auth.uid()));

create policy "client_pins" on pins
  for all using (deliverable_id in (
    select id from deliverables where client_id in (select client_id from client_users where id = auth.uid())
  ));

create policy "client_pin_replies" on pin_replies
  for all using (pin_id in (
    select id from pins where deliverable_id in (
      select id from deliverables where client_id in (select client_id from client_users where id = auth.uid())
    )
  ));

create index idx_deliverables_project on deliverables(project_id);
create index idx_pins_deliverable on pins(deliverable_id);
create index idx_pin_replies_pin on pin_replies(pin_id);

-- Also update notification type constraint to include 'deliverable'
-- ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
-- ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type in ('invoice', 'file', 'approval', 'message', 'task', 'deliverable'));

-- Supabase Storage bucket RLS policies for ClientDeskBucket
-- Note: Run these in the Supabase SQL Editor if they are not active.
create policy "Allow authenticated uploads to ClientDeskBucket" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ClientDeskBucket');

create policy "Allow authenticated select from ClientDeskBucket" on storage.objects
  for select to authenticated
  using (bucket_id = 'ClientDeskBucket');

create policy "Allow public read from ClientDeskBucket" on storage.objects
  for select to public
  using (bucket_id = 'ClientDeskBucket');

-- ===== Project tabs: client uploads, RLS for files/tasks/messages, realtime =====
BEGIN;

-- Client uploads folder + allow auth users (agency or client) as uploader
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_folder_check;
ALTER TABLE files ADD CONSTRAINT files_folder_check
  CHECK (folder IN ('designs','contracts','invoices','reports','brand_assets','client_uploads'));
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_uploaded_by_fkey;
ALTER TABLE files ADD CONSTRAINT files_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- FILES
DROP POLICY IF EXISTS "agency_own_files" ON files;
CREATE POLICY "agency_own_files" ON files FOR ALL
  USING (agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()))
  WITH CHECK (agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "client_own_files" ON files;
CREATE POLICY "client_own_files" ON files FOR SELECT
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    OR project_id IN (
      SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "client_insert_files" ON files;
CREATE POLICY "client_insert_files" ON files FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND folder = 'client_uploads'
    AND is_locked = false
    AND client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    AND project_id IN (
      SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    )
    AND agency_id = (SELECT agency_id FROM projects WHERE id = project_id)
  );

-- TASKS
DROP POLICY IF EXISTS "agency_own_tasks" ON tasks;
CREATE POLICY "agency_own_tasks" ON tasks FOR ALL
  USING (agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()))
  WITH CHECK (agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "client_view_tasks" ON tasks;
CREATE POLICY "client_view_tasks" ON tasks FOR SELECT
  USING (
    visible_to_client = true
    AND project_id IN (
      SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    )
  );

-- MESSAGES
DROP POLICY IF EXISTS "agency_own_messages" ON messages;
CREATE POLICY "agency_own_messages" ON messages FOR ALL
  USING (agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()))
  WITH CHECK (agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "client_own_messages" ON messages;
DROP POLICY IF EXISTS "client_select_messages" ON messages;
DROP POLICY IF EXISTS "client_insert_messages" ON messages;
DROP POLICY IF EXISTS "client_update_messages" ON messages;
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

-- Realtime
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages','tasks','files','pins','pin_replies'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ===== Proofing policies + approval unlock function =====
BEGIN;

-- Proofing tables: policies (RLS was enabled without any policy)
DROP POLICY IF EXISTS "agency_deliverables" ON deliverables;
CREATE POLICY "agency_deliverables" ON deliverables FOR ALL
  USING (agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()))
  WITH CHECK (agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "client_deliverables" ON deliverables;
CREATE POLICY "client_deliverables" ON deliverables FOR SELECT
  USING (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "client_update_deliverables" ON deliverables;
CREATE POLICY "client_update_deliverables" ON deliverables FOR UPDATE
  USING (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()))
  WITH CHECK (client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()));

-- Only client users may change approval status (approved/changes_requested)
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

DROP TRIGGER IF EXISTS trg_deliverable_approval_role ON deliverables;
CREATE TRIGGER trg_deliverable_approval_role
  BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION enforce_deliverable_approval_role();

DROP POLICY IF EXISTS "agency_pins" ON pins;
CREATE POLICY "agency_pins" ON pins FOR ALL
  USING (deliverable_id IN (SELECT id FROM deliverables WHERE agency_id = (SELECT agency_id FROM users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "client_pins" ON pins;
CREATE POLICY "client_pins" ON pins FOR ALL
  USING (deliverable_id IN (SELECT id FROM deliverables WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "agency_pin_replies" ON pin_replies;
CREATE POLICY "agency_pin_replies" ON pin_replies FOR ALL
  USING (pin_id IN (SELECT id FROM pins WHERE deliverable_id IN (
    SELECT id FROM deliverables WHERE agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()))));

DROP POLICY IF EXISTS "client_pin_replies" ON pin_replies;
CREATE POLICY "client_pin_replies" ON pin_replies FOR ALL
  USING (pin_id IN (SELECT id FROM pins WHERE deliverable_id IN (
    SELECT id FROM deliverables WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid()))));

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

COMMIT;

-- ===== AI summary rate limiting (replaces the in-memory limiter) =====
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_agency_created ON ai_usage (agency_id, created_at DESC);
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;  -- no policies: only the service role touches it

-- Atomically: count this agency's calls in the last hour, refuse at p_limit, otherwise record one.
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


-- ===== Client portal policies the original schema lacked + recursion-safe helper =====
CREATE OR REPLACE FUNCTION public.current_client_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM client_users WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.current_client_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.current_client_ids() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "client_own_client" ON clients;
CREATE POLICY "client_own_client" ON clients FOR SELECT USING (id IN (SELECT public.current_client_ids()));

DROP POLICY IF EXISTS "client_own_timeline" ON timeline_updates;
CREATE POLICY "client_own_timeline" ON timeline_updates FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "client_own_approvals" ON approvals;
CREATE POLICY "client_own_approvals" ON approvals FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "client_update_approvals" ON approvals;
CREATE POLICY "client_update_approvals" ON approvals FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "client_own_milestones" ON milestones;
CREATE POLICY "client_own_milestones" ON milestones FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "notifications_cross_insert" ON notifications;
CREATE POLICY "notifications_cross_insert" ON notifications FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()))
    OR user_id IN (SELECT cu.id FROM client_users cu JOIN clients c ON c.id = cu.client_id
                   WHERE c.agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()))
    OR user_id IN (SELECT id FROM users WHERE agency_id IN (
         SELECT c.agency_id FROM client_users cu JOIN clients c ON c.id = cu.client_id WHERE cu.id = auth.uid()))
  );

-- ===== Tightened agencies/users/notifications policies, notifications FK -> auth.users, public branding RPC =====
BEGIN;
-- 1. notifications.user_id must accept portal clients (auth.users), not only agency users
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.notifications'::regclass AND conname='notifications_user_id_fkey'
             AND confrelid <> 'auth.users'::regclass) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.notifications'::regclass AND conname='notifications_user_id_fkey') THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. RLS-safe helpers (SECURITY DEFINER so policies on users/agencies never recurse)
CREATE OR REPLACE FUNCTION public.current_agency_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT agency_id FROM users WHERE id = auth.uid() $$;
CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT role FROM users WHERE id = auth.uid() $$;
CREATE OR REPLACE FUNCTION public.current_client_agency_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.agency_id FROM client_users cu JOIN clients c ON c.id = cu.client_id WHERE cu.id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.current_agency_id(), public.current_user_role(), public.current_client_agency_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.current_agency_id(), public.current_user_role(), public.current_client_agency_ids() TO anon, authenticated, service_role;

-- 3. Public branding for the client login page: only name, logo and colour for one known agency id
CREATE OR REPLACE FUNCTION public.get_agency_branding(p_agency_id uuid)
RETURNS TABLE(name text, logo_url text, primary_color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.name, a.logo_url, a.primary_color FROM agencies a WHERE a.id = p_agency_id
$$;
REVOKE ALL ON FUNCTION public.get_agency_branding(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_agency_branding(uuid) TO anon, authenticated, service_role;

-- 4a. Helper to read current stripe fields without recursion (used by agency_update_admin)
CREATE OR REPLACE FUNCTION public.current_agency_stripe()
RETURNS TABLE(stripe_account_id text, stripe_connected boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.stripe_account_id, a.stripe_connected
  FROM agencies a WHERE a.id = (SELECT agency_id FROM users WHERE id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.current_agency_stripe() FROM public;
GRANT EXECUTE ON FUNCTION public.current_agency_stripe() TO anon, authenticated, service_role;

-- 4b. agencies: no public select; own agency (and, for portal users, their client's agency); no client-side insert (signup uses the service role)
DROP POLICY IF EXISTS "agency_select" ON agencies;
DROP POLICY IF EXISTS "agency_insert" ON agencies;
DROP POLICY IF EXISTS "agencies_select_scoped" ON agencies;
CREATE POLICY "agencies_select_scoped" ON agencies FOR SELECT
  USING (id = public.current_agency_id() OR id IN (SELECT public.current_client_agency_ids()));

-- 4c. agencies UPDATE: admin-only, stripe columns immutable from client side
DROP POLICY IF EXISTS "agency_update" ON agencies;
DROP POLICY IF EXISTS "agency_update_admin" ON agencies;
CREATE POLICY "agency_update_admin" ON agencies FOR UPDATE
  USING (id = public.current_agency_id() AND public.current_user_role() = 'admin')
  WITH CHECK (
    id = public.current_agency_id()
    AND public.current_user_role() = 'admin'
    AND stripe_account_id IS NOT DISTINCT FROM (SELECT s.stripe_account_id FROM public.current_agency_stripe() s)
    AND stripe_connected IS NOT DISTINCT FROM (SELECT s.stripe_connected FROM public.current_agency_stripe() s)
  );

-- 5. users: same agency only (portal users see their agency's staff); no client-side insert; no self-promotion or agency switching
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_select_scoped" ON users;
DROP POLICY IF EXISTS "users_update_self" ON users;
CREATE POLICY "users_select_scoped" ON users FOR SELECT
  USING (id = auth.uid() OR agency_id = public.current_agency_id() OR agency_id IN (SELECT public.current_client_agency_ids()));
CREATE POLICY "users_update_self" ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid()
              AND agency_id IS NOT DISTINCT FROM public.current_agency_id()
              AND role IS NOT DISTINCT FROM public.current_user_role());

-- 6. notifications: users read/update/delete only their own (agency users and portal clients alike); inserts only via notifications_cross_insert
DROP POLICY IF EXISTS "own_notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE USING (user_id = auth.uid());

-- 7. realtime for the notification bell
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
COMMIT;
