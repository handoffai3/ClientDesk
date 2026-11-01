-- Landing-page "Request a live demo" submissions. Idempotent.
-- anon may INSERT only; nobody but the service role can read, change or delete rows.
CREATE TABLE IF NOT EXISTS public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200 AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  agency_name text NOT NULL CHECK (char_length(agency_name) BETWEEN 1 AND 150),
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_demo_requests_ip_created ON public.demo_requests (ip_hash, created_at);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_demo_requests" ON public.demo_requests;
CREATE POLICY "anon_insert_demo_requests" ON public.demo_requests FOR INSERT TO anon WITH CHECK (true);

REVOKE ALL ON public.demo_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.demo_requests TO anon;
