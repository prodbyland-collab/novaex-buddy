CREATE TABLE public.group_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('code', 'news')),
  body text NOT NULL DEFAULT '',
  code text,
  code_date date UNIQUE,
  expires_at timestamptz,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'code' AND code IS NOT NULL AND code_date IS NOT NULL AND expires_at IS NOT NULL)
    OR (kind = 'news' AND code IS NULL AND code_date IS NULL AND expires_at IS NULL AND length(trim(body)) BETWEEN 1 AND 3000))
);
ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_announcements FROM anon, authenticated;
GRANT SELECT ON public.group_announcements TO authenticated;
GRANT ALL ON public.group_announcements TO service_role;
CREATE POLICY "Members read announcements" ON public.group_announcements
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.publish_daily_group_code()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_id uuid;
  v_code text;
  v_posted timestamptz := now();
BEGIN
  IF (now() AT TIME ZONE 'utc')::time < time '16:00' THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('publish_daily_group_code'), hashtext(v_today::text));
  SELECT id INTO v_id FROM public.group_announcements WHERE code_date = v_today;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  v_code := public.ensure_daily_ai_code();
  UPDATE public.daily_ai_codes SET sent_at = v_posted WHERE code_date = v_today;
  INSERT INTO public.group_announcements (kind, code, code_date, expires_at, created_at)
    VALUES ('code', v_code, v_today, v_posted + interval '1 hour', v_posted)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_daily_group_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_daily_group_code() TO service_role;

-- Preserve the existing administrator-only rotation tool, updating the group
-- and redemption authority together in one transaction.
CREATE OR REPLACE FUNCTION public.rotate_daily_group_code()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_code text;
  v_posted timestamptz := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('publish_daily_group_code'), hashtext(v_today::text));
  DELETE FROM public.daily_ai_codes WHERE code_date = v_today;
  v_code := public.ensure_daily_ai_code();
  UPDATE public.daily_ai_codes SET sent_at = v_posted WHERE code_date = v_today;
  INSERT INTO public.group_announcements (kind, code, code_date, expires_at, created_at)
    VALUES ('code', v_code, v_today, v_posted + interval '1 hour', v_posted)
    ON CONFLICT (code_date) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, created_at = EXCLUDED.created_at;
  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_daily_group_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_daily_group_code() TO service_role;

-- Supabase Cron schedules use UTC. 16:00 UTC = 20:00 in Tbilisi.
-- Retries do not extend the redemption window or create a second daily post.
SELECT cron.schedule('gng-site-daily-code', '0 16 * * *', 'SELECT public.publish_daily_group_code();');
SELECT public.publish_daily_group_code();
