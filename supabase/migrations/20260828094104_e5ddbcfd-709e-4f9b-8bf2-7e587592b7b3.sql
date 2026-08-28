
ALTER TABLE public.ai_trading_settings
  ADD COLUMN IF NOT EXISTS plan_id text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_rate numeric NOT NULL DEFAULT 0.01;

ALTER TABLE public.crypto_deposits
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'balance',
  ADD COLUMN IF NOT EXISTS plan_id text;

CREATE OR REPLACE FUNCTION public.credit_crypto_deposit(p_payment_id text, p_status text, p_actually_paid numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit public.crypto_deposits%ROWTYPE;
  v_rate numeric;
BEGIN
  SELECT * INTO v_deposit FROM public.crypto_deposits WHERE payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.crypto_deposits
     SET status = p_status,
         actually_paid = GREATEST(p_actually_paid, 0),
         updated_at = now()
   WHERE id = v_deposit.id;

  IF p_status IN ('finished','confirmed') AND v_deposit.credited_at IS NULL THEN
    IF v_deposit.purpose = 'plan' THEN
      v_rate := CASE v_deposit.plan_id WHEN 'pro' THEN 0.03 WHEN 'elite' THEN 0.05 ELSE 0.01 END;

      INSERT INTO public.ai_trading_settings (user_id, enabled, plan_id, plan_rate, started_at)
      VALUES (v_deposit.user_id, true, COALESCE(v_deposit.plan_id, 'free'), v_rate, now())
      ON CONFLICT (user_id) DO UPDATE
        SET plan_id = EXCLUDED.plan_id,
            plan_rate = GREATEST(public.ai_trading_settings.plan_rate, EXCLUDED.plan_rate),
            enabled = true,
            started_at = COALESCE(public.ai_trading_settings.started_at, now()),
            updated_at = now();
    ELSE
      INSERT INTO public.holdings (user_id, symbol, amount)
      VALUES (v_deposit.user_id, 'USD', v_deposit.price_amount)
      ON CONFLICT (user_id, symbol)
      DO UPDATE SET amount = public.holdings.amount + EXCLUDED.amount;
    END IF;

    UPDATE public.crypto_deposits SET credited_at = now() WHERE id = v_deposit.id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_crypto_deposit(text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_crypto_deposit(text, text, numeric) TO service_role;

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

    v_rate := GREATEST(
                COALESCE(v_row.plan_rate, 0.01),
                CASE WHEN v_row.boost_date = v_today THEN 0.05 ELSE 0.01 END
              ) + COALESCE(v_bonus, 0);
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
