-- Add unlock_deliverable_id to files table (idempotent)
-- Links a locked file to the specific deliverable whose approval unlocks it.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'unlock_deliverable_id'
  ) THEN
    ALTER TABLE files ADD COLUMN unlock_deliverable_id uuid REFERENCES deliverables(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop old single-arg version so the new two-arg version can take its place
DROP FUNCTION IF EXISTS unlock_approval_files(uuid);

-- Approval unlock: now supports per-deliverable unlocking.
-- p_deliverable_id is optional: when set, only files linked to that deliverable unlock;
-- when null, all unlinked approval-locked files in the project unlock (legacy).
CREATE OR REPLACE FUNCTION unlock_approval_files(p_project_id uuid, p_deliverable_id uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects p JOIN client_users cu ON cu.client_id = p.client_id WHERE p.id = p_project_id AND cu.id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM projects p JOIN users u ON u.agency_id = p.agency_id WHERE p.id = p_project_id AND u.id = auth.uid())
  THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF p_deliverable_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM deliverables WHERE id = p_deliverable_id AND project_id = p_project_id AND status = 'approved') THEN
      RAISE EXCEPTION 'deliverable not approved';
    END IF;
    UPDATE files SET unlocked_at = now()
     WHERE unlock_deliverable_id = p_deliverable_id AND is_locked = true AND unlock_type = 'approval' AND unlocked_at IS NULL;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM deliverables WHERE project_id = p_project_id AND status = 'approved') THEN
      RAISE EXCEPTION 'no approved deliverable on this project';
    END IF;
    UPDATE files SET unlocked_at = now()
     WHERE project_id = p_project_id AND is_locked = true AND unlock_type = 'approval' AND unlocked_at IS NULL
       AND unlock_deliverable_id IS NULL;
  END IF;
END $$;
REVOKE ALL ON FUNCTION unlock_approval_files(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION unlock_approval_files(uuid, uuid) TO authenticated;

-- Set demo file to approval-based unlock linked to the Home screen design deliverable
UPDATE files SET
  unlock_type = 'approval',
  unlock_deliverable_id = '8e84ee1d-7533-46a0-9b6f-5924fcdf641e',
  unlock_invoice_id = NULL
WHERE id = '72dc63fd-a6cf-46c7-8eed-0288683a2b41';
