-- Replace both legacy permissive read policies; keep the verified-session guard.
-- Requires 20261004120000_secure_accounting.sql.
BEGIN;
ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_announcements FROM anon, authenticated;
GRANT SELECT ON public.group_announcements TO authenticated;
GRANT ALL ON public.group_announcements TO service_role;
DROP POLICY IF EXISTS "Members read announcements" ON public.group_announcements;
DROP POLICY IF EXISTS group_announcements_select ON public.group_announcements;
DROP POLICY IF EXISTS group_announcements_verified_read ON public.group_announcements;
CREATE POLICY group_announcements_verified_read
  ON public.group_announcements FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND public.session_is_verified()
    AND created_at <= now()
  );
COMMIT;
