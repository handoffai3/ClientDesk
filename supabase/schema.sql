-- AGENCIES (the main account / white-label owner)
create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text default '#7C3AED',
  custom_domain text,
  email text not null unique,
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
  created_at timestamp default now()
);

-- INVOICES
create table invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  invoice_number text not null unique,
  status text check (status in ('paid', 'pending', 'overdue')) default 'pending',
  subtotal numeric(10,2) not null default 0,
  gst_rate numeric(5,2) default 18,
  gst_amount numeric(10,2) default 0,
  total numeric(10,2) not null default 0,
  issue_date date default current_date,
  due_date date,
  notes text,
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
  user_id uuid references users(id) on delete cascade,
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
create policy "agency_select" on agencies
  for select using (true); -- Allow select to let users resolve agency names during signup/login

create policy "agency_insert" on agencies
  for insert with check (true);

-- Users table policies
create policy "users_select" on users
  for select using (true); -- Allow users to resolve names and profiles of teammates

create policy "users_insert" on users
  for insert with check (true);

create policy "users_update" on users
  for update using (id = auth.uid());

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
