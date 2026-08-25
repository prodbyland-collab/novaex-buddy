-- 1. AI trading on by default
ALTER TABLE public.ai_trading_settings ALTER COLUMN enabled SET DEFAULT true;
ALTER TABLE public.ai_trading_settings ADD COLUMN IF NOT EXISTS boost_date date;
UPDATE public.ai_trading_settings SET enabled = true, started_at = COALESCE(started_at, now())
 WHERE enabled = false AND started_at IS NULL;

-- 2. Daily codes (server-only)
CREATE TABLE IF NOT EXISTS public.daily_ai_codes (
  code_date date PRIMARY KEY,
  code text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.daily_ai_codes TO service_role;
ALTER TABLE public.daily_ai_codes ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: codes are only readable by the server (service role bypasses RLS).

-- 3. Generate / fetch today's code (server only)
CREATE OR REPLACE FUNCTION public.ensure_daily_ai_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_code text;
BEGIN
  SELECT code INTO v_code FROM public.daily_ai_codes WHERE code_date = v_today;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := 'NOVA-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  INSERT INTO public.daily_ai_codes (code_date, code) VALUES (v_today, v_code)
  ON CONFLICT (code_date) DO NOTHING;

  SELECT code INTO v_code FROM public.daily_ai_codes WHERE code_date = v_today;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_daily_ai_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_daily_ai_code() TO service_role;

CREATE OR REPLACE FUNCTION public.mark_daily_ai_code_sent()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.daily_ai_codes SET sent_at = now()
   WHERE code_date = (now() AT TIME ZONE 'utc')::date;
$$;
REVOKE ALL ON FUNCTION public.mark_daily_ai_code_sent() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_daily_ai_code_sent() TO service_role;

-- 4. Redeem today's code -> 5% boost for today
CREATE OR REPLACE FUNCTION public.redeem_ai_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_uid uuid := auth.uid();
  v_valid boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in');
  END IF;

  SELECT true INTO v_valid
    FROM public.daily_ai_codes
   WHERE code_date = v_today
     AND upper(trim(p_code)) = upper(code);

  IF NOT COALESCE(v_valid, false) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That code is not valid today');
  END IF;

  UPDATE public.ai_trading_settings
     SET enabled = true,
         daily_rate = 0.05,
         boost_date = v_today,
         started_at = COALESCE(started_at, now())
   WHERE user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'message', 'Boost unlocked: 5% for today', 'boost_date', v_today);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_ai_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_ai_code(text) TO authenticated, service_role;

-- 5. Payout uses boosted rate, then resets it
CREATE OR REPLACE FUNCTION public.run_daily_ai_trading_payout()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row record;
  v_usd numeric;
  v_rate numeric;
  v_profit numeric;
  v_count integer := 0;
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_symbols text[] := ARRAY['BTC','ETH','SOL','XRP'];
  v_sym text;
  v_i integer;
BEGIN
  FOR v_row IN
    SELECT * FROM public.ai_trading_settings
     WHERE enabled = true
       AND (last_payout_date IS NULL OR last_payout_date < v_today)
     FOR UPDATE
  LOOP
    SELECT amount INTO v_usd
      FROM public.holdings
     WHERE user_id = v_row.user_id AND symbol = 'USD';

    v_usd := COALESCE(v_usd, 0);
    v_rate := CASE WHEN v_row.boost_date = v_today THEN 0.05 ELSE 0.01 END;
    v_profit := round(v_usd * v_rate, 2);

    IF v_profit > 0 THEN
      UPDATE public.holdings
         SET amount = amount + v_profit
       WHERE user_id = v_row.user_id AND symbol = 'USD';

      FOR v_i IN 1..3 LOOP
        v_sym := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
        INSERT INTO public.ai_trades (user_id, symbol, side, amount, price, profit)
        VALUES (
          v_row.user_id,
          v_sym,
          CASE WHEN v_i % 2 = 0 THEN 'sell' ELSE 'buy' END,
          round((v_profit / 3 / GREATEST(random() * 40000 + 100, 1))::numeric, 8),
          round((random() * 40000 + 100)::numeric, 2),
          round((v_profit / 3)::numeric, 2)
        );
      END LOOP;
    END IF;

    UPDATE public.ai_trading_settings
       SET last_payout_date = v_today,
           last_accrued_at = now(),
           daily_rate = 0.01,
           total_profit = COALESCE(total_profit, 0) + v_profit
     WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
