CREATE OR REPLACE FUNCTION public.ensure_daily_ai_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i integer;
BEGIN
  SELECT code INTO v_code FROM public.daily_ai_codes WHERE code_date = v_today;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := 'NOVA-';
  FOR v_i IN 1..8 LOOP
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  END LOOP;

  INSERT INTO public.daily_ai_codes (code_date, code) VALUES (v_today, v_code)
  ON CONFLICT (code_date) DO NOTHING;

  SELECT code INTO v_code FROM public.daily_ai_codes WHERE code_date = v_today;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_daily_ai_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_daily_ai_code() TO service_role;