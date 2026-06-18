-- Disable RLS temporarily
alter table agencies disable row level security;
alter table users disable row level security;
alter table clients disable row level security;
alter table client_users disable row level security;
alter table projects disable row level security;
alter table timeline_updates disable row level security;
alter table tasks disable row level security;
alter table files disable row level security;
alter table invoices disable row level security;
alter table invoice_items disable row level security;
alter table approvals disable row level security;
alter table milestones disable row level security;
alter table messages disable row level security;
alter table activity_logs disable row level security;
alter table notifications disable row level security;

-- Seed Data
DO $$
DECLARE
  v_agency_id uuid := '11111111-1111-1111-1111-111111111111';
  v_client1_id uuid := '22222222-2222-2222-2222-222222222222';
  v_client2_id uuid := '33333333-3333-3333-3333-333333333333';
  v_project1_id uuid := '44444444-4444-4444-4444-444444444444';
  v_project2_id uuid := '55555555-5555-5555-5555-555555555555';
BEGIN
  -- 1. Create an Agency
  INSERT INTO agencies (id, name, primary_color, email) 
  VALUES (v_agency_id, 'ClientDesk Agency', '#630ED4', 'admin@clientdesk.com')
  ON CONFLICT DO NOTHING;

  -- 2. Create Clients
  INSERT INTO clients (id, agency_id, full_name, company, email, status)
  VALUES (v_client1_id, v_agency_id, 'Sarah Jenkins', 'TechFlow Inc', 'sarah@techflow.com', 'active'),
         (v_client2_id, v_agency_id, 'Michael Ross', 'Global Logistics', 'michael@globallogistics.com', 'active')
  ON CONFLICT DO NOTHING;

  -- 3. Create Projects
  INSERT INTO projects (id, agency_id, client_id, name, description, progress, status)
  VALUES (v_project1_id, v_agency_id, v_client1_id, 'TechFlow Website Redesign', 'Phase 2: Development & Integration', 68, 'active'),
         (v_project2_id, v_agency_id, v_client2_id, 'Q3 Marketing Campaign', 'Asset gathering and timeline estimation.', 15, 'active')
  ON CONFLICT DO NOTHING;

  -- 4. Create Invoices
  INSERT INTO invoices (agency_id, client_id, project_id, invoice_number, status, subtotal, total, due_date)
  VALUES (v_agency_id, v_client1_id, v_project1_id, 'INV-2023-089', 'pending', 4500.00, 5310.00, current_date + interval '3 days'),
         (v_agency_id, v_client2_id, v_project2_id, 'INV-2023-084', 'paid', 1200.00, 1416.00, current_date - interval '30 days')
  ON CONFLICT DO NOTHING;

  -- 5. Create Files
  INSERT INTO files (agency_id, project_id, client_id, file_name, file_url, file_size, file_type, folder)
  VALUES (v_agency_id, v_project1_id, v_client1_id, 'Q2_Financial_Report_Final.pdf', 'https://example.com/file1.pdf', 2500000, 'application/pdf', 'reports'),
         (v_agency_id, v_project1_id, v_client1_id, 'Hero_Banner_V3_Approved.png', 'https://example.com/file2.png', 8500000, 'image/png', 'designs')
  ON CONFLICT DO NOTHING;

  -- 6. Create Tasks
  INSERT INTO tasks (agency_id, project_id, title, description, priority, category, status)
  VALUES (v_agency_id, v_project1_id, 'Finalize UI Designs', 'Complete the final iterations for the client portal dashboard based on recent feedback.', 'high', 'Design', 'today'),
         (v_agency_id, v_project1_id, 'API Integration', 'Connect frontend components with the new REST API endpoints for user data.', 'medium', 'Development', 'today'),
         (v_agency_id, v_project1_id, 'User Interviews', 'Conduct 5 user interviews to validate the new workflow assumptions.', 'medium', 'Research', 'this_week')
  ON CONFLICT DO NOTHING;

END $$;
