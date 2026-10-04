-- Daily publication at 20:00 Asia/Tbilisi (16:00 UTC), valid for 10 minutes.
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
    VALUES ('code', v_code, v_today, v_posted + interval '10 minutes', v_posted)
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
    VALUES ('code', v_code, v_today, v_posted + interval '10 minutes', v_posted)
    ON CONFLICT (code_date) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, created_at = EXCLUDED.created_at;
  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_daily_group_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_daily_group_code() TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_ai_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.daily_ai_codes; v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  PERFORM public.ensure_my_account();
  SELECT * INTO r FROM public.daily_ai_codes WHERE code_date = v_today AND code = upper(trim(p_code));
  IF NOT FOUND OR COALESCE(r.sent_at,r.created_at) <= now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('ok',false,'message','That code is invalid or expired');
  END IF;
  IF EXISTS(SELECT 1 FROM public.ai_trading_settings WHERE user_id = auth.uid() AND last_payout_date = v_today) THEN
    RETURN jsonb_build_object('ok',false,'message','Today''s payout has already been processed');
  END IF;
  UPDATE public.ai_trading_settings SET enabled = true, boost_date = v_today WHERE user_id = auth.uid();
  RETURN jsonb_build_object('ok',true,'message','Boost unlocked: +1% for today','boost_date',v_today);
END $$;
REVOKE ALL ON FUNCTION public.redeem_ai_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_ai_code(text) TO authenticated;

UPDATE public.group_announcements SET expires_at = LEAST(expires_at, created_at + interval '10 minutes') WHERE kind = 'code';
SELECT cron.schedule('gng-site-daily-code', '0 16 * * *', 'SELECT public.publish_daily_group_code();');
NOTIFY pgrst, 'reload schema';
