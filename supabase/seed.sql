-- ============================================================
-- ClientDesk — demo seed data
-- Run AFTER schema.sql in the Supabase SQL Editor.
--
-- Creates a demo agency, two clients, two projects, invoices,
-- files, tasks, a deliverable, and timeline updates.
--
-- NOTE: Agency owner and client portal users must be created
-- via Supabase Auth (sign-up flow or the Auth dashboard).
-- After sign-up, insert a row into `users` (for the agency
-- owner) or `client_users` (for a portal login) linking to
-- the auth.users ID.
-- ============================================================

-- Temporarily disable RLS so seed inserts succeed without an auth context
ALTER TABLE agencies DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE files DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables DISABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_updates DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_agency  uuid := '11111111-1111-1111-1111-111111111111';
  v_client1 uuid := '22222222-2222-2222-2222-222222222222';
  v_client2 uuid := '33333333-3333-3333-3333-333333333333';
  v_proj1   uuid := '44444444-4444-4444-4444-444444444444';
  v_proj2   uuid := '55555555-5555-5555-5555-555555555555';
  v_inv1    uuid := '66666666-6666-6666-6666-666666666666';
  v_inv2    uuid := '77777777-7777-7777-7777-777777777777';
  v_deliv   uuid := '88888888-8888-8888-8888-888888888888';
BEGIN
  -- Agency
  INSERT INTO agencies (id, name, email, primary_color)
  VALUES (v_agency, 'Demo Agency', 'hello@demo-agency.com', '#7C3AED')
  ON CONFLICT DO NOTHING;

  -- Clients
  INSERT INTO clients (id, agency_id, full_name, company, email, status)
  VALUES
    (v_client1, v_agency, 'Sarah Jenkins', 'TechFlow Inc', 'sarah@example.com', 'active'),
    (v_client2, v_agency, 'Michael Ross', 'Global Logistics', 'michael@example.com', 'active')
  ON CONFLICT DO NOTHING;

  -- Projects
  INSERT INTO projects (id, agency_id, client_id, name, description, progress, status, deadline)
  VALUES
    (v_proj1, v_agency, v_client1, 'Website Redesign',
     'Phase 2: Development & integration of the new marketing site.',
     68, 'active', (current_date + interval '30 days')::date),
    (v_proj2, v_agency, v_client2, 'Q3 Marketing Campaign',
     'Asset gathering, creative production, and campaign launch.',
     15, 'active', (current_date + interval '45 days')::date)
  ON CONFLICT DO NOTHING;

  -- Invoices
  INSERT INTO invoices (id, agency_id, client_id, project_id, invoice_number, status, subtotal, gst_rate, gst_amount, total, due_date)
  VALUES
    (v_inv1, v_agency, v_client1, v_proj1, 'INV-001', 'pending',
     4500.00, 18, 810.00, 5310.00, (current_date + interval '14 days')::date),
    (v_inv2, v_agency, v_client2, v_proj2, 'INV-002', 'paid',
     1200.00, 18, 216.00, 1416.00, (current_date - interval '7 days')::date)
  ON CONFLICT DO NOTHING;

  INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount)
  VALUES
    (v_inv1, 'UI/UX design', 1, 2500.00, 2500.00),
    (v_inv1, 'Frontend development', 1, 2000.00, 2000.00),
    (v_inv2, 'Campaign strategy document', 1, 1200.00, 1200.00);

  -- Files (placeholder URLs — replace with real storage URLs after uploading)
  INSERT INTO files (agency_id, project_id, client_id, file_name, file_url, file_path, file_size, file_type, folder)
  VALUES
    (v_agency, v_proj1, v_client1, 'Homepage_Mockup_v3.png',
     'https://placehold.co/1200x800/7C3AED/white?text=Homepage+Mockup',
     NULL, 2500000, 'image/png', 'designs'),
    (v_agency, v_proj1, v_client1, 'Brand_Guidelines.pdf',
     'https://placehold.co/800x1100/333/white?text=Brand+Guidelines',
     NULL, 850000, 'application/pdf', 'brand_assets')
  ON CONFLICT DO NOTHING;

  -- Tasks
  INSERT INTO tasks (agency_id, project_id, title, description, priority, category, status, visible_to_client)
  VALUES
    (v_agency, v_proj1, 'Finalize hero section design', 'Complete iterations based on client feedback.', 'high', 'Design', 'today', true),
    (v_agency, v_proj1, 'API integration', 'Connect frontend components with REST endpoints.', 'medium', 'Development', 'today', false),
    (v_agency, v_proj1, 'User testing', 'Conduct 5 interviews to validate the new workflow.', 'medium', 'Research', 'this_week', false);

  -- Deliverable
  INSERT INTO deliverables (id, agency_id, project_id, client_id, title, description, file_url, file_type, status)
  VALUES
    (v_deliv, v_agency, v_proj1, v_client1, 'Homepage Concepts v1',
     'Three layout directions for the homepage hero section.',
     'https://placehold.co/1200x800/7C3AED/white?text=Homepage+Concepts',
     'image/png', 'in_review')
  ON CONFLICT DO NOTHING;

  -- Timeline updates
  INSERT INTO timeline_updates (project_id, content, status)
  VALUES
    (v_proj1, 'Kickoff meeting completed — scope and timeline agreed.', 'completed'),
    (v_proj1, 'Wireframes approved, moving to high-fidelity mockups.', 'completed'),
    (v_proj1, 'Homepage design in progress.', 'in_progress'),
    (v_proj2, 'Brief received, gathering reference materials.', 'in_progress');
END $$;

-- Re-enable RLS
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_updates ENABLE ROW LEVEL SECURITY;
