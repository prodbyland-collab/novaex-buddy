CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referrer_id <> referee_id)
);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_referrals_select" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE TABLE public.referral_codes (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_referral_code_select" ON public.referral_codes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_my_referral_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_count integer;
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

  RETURN jsonb_build_object(
    'ok', true,
    'code', v_code,
    'referrals', v_count,
    'bonus_rate', LEAST(v_count * 0.005, 0.05),
    'invited_by', (SELECT true FROM public.referrals WHERE referee_id = v_uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_referrer uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'You have already used an invite code');
  END IF;

  SELECT user_id INTO v_referrer FROM public.referral_codes WHERE upper(code) = v_code;

  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That invite code does not exist');
  END IF;

  IF v_referrer = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'message', 'You cannot use your own invite code');
  END IF;

  INSERT INTO public.referrals (referrer_id, referee_id, code)
  VALUES (v_referrer, v_uid, v_code)
  ON CONFLICT (referee_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'message', 'Invite applied — your inviter now earns a bigger daily rate');
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_referral_info() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_info() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated, service_role;

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

    v_rate := (CASE WHEN v_row.boost_date = v_today THEN 0.05 ELSE 0.01 END)
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
           daily_rate = 0.01,
           total_profit = COALESCE(total_profit, 0) + v_profit
     WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;