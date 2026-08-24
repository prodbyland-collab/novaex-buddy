ALTER TABLE public.ai_trading_settings
  ADD COLUMN IF NOT EXISTS last_payout_date date;

-- Daily end-of-day payout for every account with AI trading enabled.
CREATE OR REPLACE FUNCTION public.run_daily_ai_trading_payout()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row record;
  v_usd numeric;
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
    v_profit := round(v_usd * COALESCE(v_row.daily_rate, 0.01), 2);

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
           total_profit = COALESCE(total_profit, 0) + v_profit
     WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.run_daily_ai_trading_payout() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_ai_trading_payout() TO service_role;

-- Continuous per-request accrual is replaced by the daily payout above.
DROP FUNCTION IF EXISTS public.accrue_ai_trading_profit();