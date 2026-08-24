CREATE TABLE public.ai_trading_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE DEFAULT auth.uid(),
  enabled boolean NOT NULL DEFAULT false,
  daily_rate numeric NOT NULL DEFAULT 0.01,
  started_at timestamptz,
  last_accrued_at timestamptz,
  total_profit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_trading_settings TO authenticated;
GRANT ALL ON public.ai_trading_settings TO service_role;
ALTER TABLE public.ai_trading_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_ai_settings" ON public.ai_trading_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ai_trades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  symbol text NOT NULL,
  side text NOT NULL,
  amount numeric NOT NULL,
  price numeric NOT NULL,
  profit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_trades TO authenticated;
GRANT ALL ON public.ai_trades TO service_role;
ALTER TABLE public.ai_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_ai_trades_select" ON public.ai_trades FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ai_trading_settings_updated_at
BEFORE UPDATE ON public.ai_trading_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.accrue_ai_trading_profit()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settings public.ai_trading_settings%ROWTYPE;
  v_base numeric;
  v_seconds numeric;
  v_profit numeric := 0;
  v_symbols text[] := ARRAY['BTC','ETH','SOL','XRP'];
  v_i int;
  v_slice numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_settings FROM public.ai_trading_settings WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RETURN 0;
  END IF;

  v_seconds := GREATEST(EXTRACT(EPOCH FROM (now() - COALESCE(v_settings.last_accrued_at, v_settings.started_at, now()))), 0);
  IF v_seconds < 30 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_base
    FROM public.holdings WHERE user_id = v_uid AND symbol = 'USD';

  IF v_base <= 0 THEN
    UPDATE public.ai_trading_settings SET last_accrued_at = now() WHERE id = v_settings.id;
    RETURN 0;
  END IF;

  v_profit := ROUND(v_base * v_settings.daily_rate * (v_seconds / 86400.0), 6);
  IF v_profit <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.holdings (user_id, symbol, amount)
  VALUES (v_uid, 'USD', v_profit)
  ON CONFLICT (user_id, symbol)
  DO UPDATE SET amount = public.holdings.amount + EXCLUDED.amount;

  FOR v_i IN 1..2 LOOP
    v_slice := ROUND(v_profit / 2.0, 6);
    INSERT INTO public.ai_trades (user_id, symbol, side, amount, price, profit)
    VALUES (
      v_uid,
      v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int],
      CASE WHEN random() < 0.5 THEN 'buy' ELSE 'sell' END,
      ROUND((v_slice / 100.0)::numeric, 6),
      ROUND((1000 + random() * 60000)::numeric, 2),
      v_slice
    );
  END LOOP;

  UPDATE public.ai_trading_settings
     SET last_accrued_at = now(),
         total_profit = total_profit + v_profit
   WHERE id = v_settings.id;

  RETURN v_profit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accrue_ai_trading_profit() TO authenticated;