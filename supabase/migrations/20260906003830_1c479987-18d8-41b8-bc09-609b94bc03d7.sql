CREATE OR REPLACE FUNCTION public.redeem_ai_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_uid uuid := auth.uid();
  v_row public.daily_ai_codes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in');
  END IF;

  SELECT * INTO v_row
    FROM public.daily_ai_codes
   WHERE code_date = v_today
     AND upper(trim(p_code)) = upper(code);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That code is not valid');
  END IF;

  IF COALESCE(v_row.sent_at, v_row.created_at) < now() - interval '1 hour' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That code has expired — codes are only valid for 1 hour');
  END IF;

  UPDATE public.ai_trading_settings
     SET enabled = true,
         daily_rate = 0.05,
         boost_date = v_today,
         started_at = COALESCE(started_at, now())
   WHERE user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'message', 'Boost unlocked: +5% for today', 'boost_date', v_today);
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_expired_ai_codes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.daily_ai_codes
   WHERE COALESCE(sent_at, created_at) < now() - interval '1 hour';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;