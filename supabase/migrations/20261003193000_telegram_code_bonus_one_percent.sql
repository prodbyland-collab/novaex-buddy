-- Reduce only the daily Telegram code bonus from 5% to 1%.
-- Bot plan and referral rate calculations remain unchanged.

CREATE OR REPLACE FUNCTION public.run_daily_ai_trading_payout()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_usd numeric;
  v_rate numeric;
  v_bonus numeric;
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

    SELECT LEAST(count(*) * 0.005, 0.05) INTO v_bonus
      FROM public.referrals WHERE referrer_id = v_row.user_id;

    -- Plan rate and daily boost code now stack additively
    v_rate := COALESCE(v_row.plan_rate, 0.01)
            + CASE WHEN v_row.boost_date = v_today THEN 0.01 ELSE 0 END
            + COALESCE(v_bonus, 0);
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
           daily_rate = COALESCE(v_row.plan_rate, 0.01),
           total_profit = COALESCE(total_profit, 0) + v_profit
     WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_daily_ai_trading_payout() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_ai_trading_payout() TO service_role;
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
         daily_rate = 0.01,
         boost_date = v_today,
         started_at = COALESCE(started_at, now())
   WHERE user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'message', 'Boost unlocked: +1% for today', 'boost_date', v_today);
END;
$function$;

