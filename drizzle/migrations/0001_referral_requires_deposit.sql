CREATE OR REPLACE FUNCTION public.run_daily_ai_trading_payout()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT amount INTO v_usd FROM public.holdings WHERE user_id = v_row.user_id AND symbol = 'USD';
    v_usd := COALESCE(v_usd, 0);
    -- only count referrals whose invited user has made at least one credited deposit
    SELECT LEAST(count(*) * 0.005, 0.01) INTO v_bonus
      FROM public.referrals r
     WHERE r.referrer_id = v_row.user_id
       AND EXISTS (
         SELECT 1 FROM public.crypto_deposits d
          WHERE d.user_id = r.referee_id
            AND d.credited_at IS NOT NULL
       );
    v_rate := COALESCE(v_row.plan_rate, 0.01)
            + CASE WHEN v_row.boost_date = v_today THEN 0.05 ELSE 0 END
            + COALESCE(v_bonus, 0);
    v_profit := round(v_usd * v_rate, 2);
    IF v_profit > 0 THEN
      UPDATE public.holdings SET amount = amount + v_profit WHERE user_id = v_row.user_id AND symbol = 'USD';
      FOR v_i IN 1..3 LOOP
        v_sym := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
        INSERT INTO public.ai_trades (user_id, symbol, side, amount, price, profit)
        VALUES (
          v_row.user_id, v_sym,
          CASE WHEN v_i % 2 = 0 THEN 'sell' ELSE 'buy' END,
          round((v_profit / 3 / GREATEST(random() * 40000 + 100, 1))::numeric, 8),
          round((random() * 40000 + 100)::numeric, 2),
          round((v_profit / 3)::numeric, 2)
        );
      END LOOP;
    END IF;
    UPDATE public.ai_trading_settings
       SET last_payout_date = v_today, last_accrued_at = now(),
           daily_rate = COALESCE(v_row.plan_rate, 0.01),
           total_profit = COALESCE(total_profit, 0) + v_profit
     WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_referral_info()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_count integer;
  v_active integer;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in');
  END IF;
  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = v_uid;
  IF v_code IS NULL THEN
    LOOP
      v_code := '';
      FOR v_i IN 1..7 LOOP
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code);
    END LOOP;
    INSERT INTO public.referral_codes (user_id, code) VALUES (v_uid, v_code)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT code INTO v_code FROM public.referral_codes WHERE user_id = v_uid;
  END IF;
  SELECT count(*) INTO v_count FROM public.referrals WHERE referrer_id = v_uid;
  SELECT count(*) INTO v_active
    FROM public.referrals r
   WHERE r.referrer_id = v_uid
     AND EXISTS (
       SELECT 1 FROM public.crypto_deposits d
        WHERE d.user_id = r.referee_id
          AND d.credited_at IS NOT NULL
     );
  RETURN jsonb_build_object(
    'ok', true,
    'code', v_code,
    'referrals', v_count,
    'active_referrals', v_active,
    'bonus_rate', LEAST(v_active * 0.005, 0.01),
    'invited_by', (SELECT true FROM public.referrals WHERE referee_id = v_uid)
  );
END;
$function$;