-- All financial writes are transactional and serialized by account.
-- Withdrawals intentionally continue to use the existing completed status.
CREATE OR REPLACE FUNCTION public.session_is_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    COALESCE(auth.jwt()->>'aal', '') = 'aal2' OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors WHERE user_id = auth.uid() AND status = 'verified'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.session_is_verified() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_is_verified() TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON public.holdings, public.ai_trading_settings,
  public.withdrawals, public.orders, public.security_settings FROM authenticated;
GRANT SELECT ON public.holdings, public.ai_trading_settings, public.withdrawals,
  public.orders, public.security_settings TO authenticated;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'security_settings' AND column_name = 'approved_addresses') THEN
  ALTER TABLE public.security_settings ADD COLUMN approved_addresses text[] NOT NULL DEFAULT '{}';
  UPDATE public.security_settings s SET approved_addresses = ARRAY(
    SELECT jsonb_array_elements_text(u.raw_user_meta_data->'withdrawal_addresses') FROM auth.users u
    WHERE u.id = s.user_id AND jsonb_typeof(u.raw_user_meta_data->'withdrawal_addresses') = 'array'
  );
 END IF;
END $$;
UPDATE public.security_settings SET login_alerts = false, two_factor_enabled = false;
ALTER TABLE public.security_settings ALTER COLUMN login_alerts SET DEFAULT false;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_request_unique ON public.withdrawals(user_id, request_id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS orders_request_unique ON public.orders(user_id, request_id);

-- An aal1 token cannot bypass the login challenge using direct REST requests.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['holdings','orders','recurring_buys','security_settings',
    'crypto_deposits','withdrawals','ai_trading_settings','ai_trades','referrals',
    'referral_codes','user_roles','group_announcements','legal_acceptances'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS verified_session ON public.%I', t);
    EXECUTE format('CREATE POLICY verified_session ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.session_is_verified()) WITH CHECK (public.session_is_verified())', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.session_is_verified() THEN RAISE EXCEPTION 'Authentication verification required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  INSERT INTO public.holdings(user_id, symbol, amount) VALUES(auth.uid(), 'USD', 0) ON CONFLICT DO NOTHING;
  INSERT INTO public.ai_trading_settings(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO public.security_settings(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.ensure_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_account() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_trading_mode(p_enabled boolean)
RETURNS public.ai_trading_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ai_trading_settings;
BEGIN
  PERFORM public.ensure_my_account();
  UPDATE public.ai_trading_settings SET enabled = p_enabled, started_at = COALESCE(started_at, now())
    WHERE user_id = auth.uid() RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.set_my_trading_mode(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_trading_mode(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.configure_my_security(p_whitelist boolean, p_addresses text[])
RETURNS public.security_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.security_settings;
BEGIN
  PERFORM public.ensure_my_account();
  IF p_whitelist IS NULL OR p_addresses IS NULL OR cardinality(p_addresses) > 50 OR EXISTS (
    SELECT 1 FROM unnest(p_addresses) a WHERE a IS NULL OR length(a) NOT BETWEEN 12 AND 256 OR a ~ '[[:space:]]'
  ) OR (p_whitelist AND cardinality(p_addresses) = 0) THEN RAISE EXCEPTION 'Invalid withdrawal whitelist'; END IF;
  UPDATE public.security_settings SET withdrawal_whitelist = p_whitelist,
    approved_addresses = ARRAY(SELECT DISTINCT a FROM unnest(p_addresses) a ORDER BY a)
    WHERE user_id = auth.uid() RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.configure_my_security(boolean, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configure_my_security(boolean, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_withdrawal(p_user_id uuid, p_symbol text, p_amount numeric,
  p_address text, p_unit_price numeric, p_request_id uuid)
RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.withdrawals; s public.security_settings; v_balance numeric;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_symbol NOT IN ('USD','BTC','ETH','SOL','XRP','BNB','LTC','DOGE','TRX','USDT')
    OR p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN','Infinity','-Infinity')
    OR p_unit_price IS NULL OR p_unit_price <= 0 OR p_unit_price::text IN ('NaN','Infinity','-Infinity')
    OR p_address IS NULL OR length(trim(p_address)) NOT BETWEEN 12 AND 256 OR trim(p_address) ~ '[[:space:]]'
    THEN RAISE EXCEPTION 'Invalid withdrawal'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO r FROM public.withdrawals WHERE user_id = p_user_id AND request_id = p_request_id;
  IF FOUND THEN
    IF r.symbol <> p_symbol OR r.amount <> p_amount OR r.address <> trim(p_address) THEN RAISE EXCEPTION 'Request already used'; END IF;
    RETURN r;
  END IF;
  SELECT * INTO s FROM public.security_settings WHERE user_id = p_user_id;
  IF s.withdrawal_whitelist AND NOT (trim(p_address) = ANY(s.approved_addresses)) THEN
    RAISE EXCEPTION 'This address is not on your withdrawal whitelist';
  END IF;
  SELECT amount INTO v_balance FROM public.holdings WHERE user_id = p_user_id AND symbol = p_symbol FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.holdings SET amount = amount - p_amount WHERE user_id = p_user_id AND symbol = p_symbol;
  INSERT INTO public.withdrawals(user_id, symbol, amount, address, usd_value, fee_amount, net_amount, fee_pct, status, request_id)
    VALUES(p_user_id, p_symbol, p_amount, trim(p_address), p_amount * p_unit_price, p_amount * 0.2, p_amount * 0.8, 0.2, 'completed', p_request_id)
    RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.record_withdrawal(uuid,text,numeric,text,numeric,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_withdrawal(uuid,text,numeric,text,numeric,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.record_market_order(p_user_id uuid, p_symbol text, p_side text,
  p_amount numeric, p_price numeric, p_request_id uuid)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.orders; v_usd numeric; v_asset numeric; v_cost numeric;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_side IS NULL OR p_side NOT IN ('buy','sell')
    OR p_symbol IS NULL OR p_symbol NOT IN ('BTC','ETH','SOL','XRP','BNB','LTC','DOGE','TRX','USDT')
    OR p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN','Infinity','-Infinity')
    OR p_price IS NULL OR p_price <= 0 OR p_price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid order'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO r FROM public.orders WHERE user_id = p_user_id AND request_id = p_request_id;
  IF FOUND THEN
    IF r.symbol <> p_symbol OR r.side <> p_side OR r.amount <> p_amount THEN RAISE EXCEPTION 'Request already used'; END IF;
    RETURN r;
  END IF;
  INSERT INTO public.holdings(user_id,symbol,amount) VALUES(p_user_id,'USD',0),(p_user_id,p_symbol,0) ON CONFLICT DO NOTHING;
  SELECT amount INTO v_usd FROM public.holdings WHERE user_id = p_user_id AND symbol = 'USD' FOR UPDATE;
  SELECT amount INTO v_asset FROM public.holdings WHERE user_id = p_user_id AND symbol = p_symbol FOR UPDATE;
  v_cost := p_amount * p_price;
  IF (p_side = 'buy' AND v_usd < v_cost) OR (p_side = 'sell' AND v_asset < p_amount) THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.holdings SET amount = amount + CASE WHEN p_side = 'buy' THEN -v_cost ELSE v_cost END WHERE user_id = p_user_id AND symbol = 'USD';
  UPDATE public.holdings SET amount = amount + CASE WHEN p_side = 'buy' THEN p_amount ELSE -p_amount END WHERE user_id = p_user_id AND symbol = p_symbol;
  INSERT INTO public.orders(user_id,symbol,side,type,amount,price,status,filled_at,request_id)
    VALUES(p_user_id,p_symbol,p_side,'market',p_amount,p_price,'filled',now(),p_request_id) RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.record_market_order(uuid,text,text,numeric,numeric,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_market_order(uuid,text,text,numeric,numeric,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_change_balance(p_user_id uuid, p_symbol text, p_value numeric, p_replace boolean)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount numeric;
BEGIN
  IF p_user_id IS NULL OR p_symbol IS NULL OR p_symbol NOT IN ('USD','BTC','ETH','SOL','XRP','BNB','LTC','DOGE','TRX','USDT')
    OR p_value IS NULL OR p_value::text IN ('NaN','Infinity','-Infinity') OR p_replace IS NULL THEN RAISE EXCEPTION 'Invalid balance'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  INSERT INTO public.holdings(user_id,symbol,amount) VALUES(p_user_id,p_symbol,0) ON CONFLICT DO NOTHING;
  SELECT amount INTO v_amount FROM public.holdings WHERE user_id = p_user_id AND symbol = p_symbol FOR UPDATE;
  v_amount := CASE WHEN p_replace THEN p_value ELSE v_amount + p_value END;
  IF v_amount < 0 THEN RAISE EXCEPTION 'Balance cannot become negative'; END IF;
  UPDATE public.holdings SET amount = v_amount WHERE user_id = p_user_id AND symbol = p_symbol;
  RETURN v_amount;
END $$;
REVOKE ALL ON FUNCTION public.admin_change_balance(uuid,text,numeric,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_balance(uuid,text,numeric,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_change_withdrawal(p_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.withdrawals; v_uid uuid;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending','completed','failed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT user_id INTO v_uid FROM public.withdrawals WHERE id = p_id;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
  SELECT * INTO r FROM public.withdrawals WHERE id = p_id FOR UPDATE;
  IF r.status = p_status THEN RETURN; END IF;
  IF r.refunded_at IS NOT NULL THEN RAISE EXCEPTION 'A refunded withdrawal cannot be reopened'; END IF;
  IF p_status = 'failed' THEN
    INSERT INTO public.holdings(user_id,symbol,amount) VALUES(r.user_id,r.symbol,r.amount)
      ON CONFLICT(user_id,symbol) DO UPDATE SET amount = holdings.amount + EXCLUDED.amount;
  END IF;
  UPDATE public.withdrawals SET status = p_status,
    refunded_at = CASE WHEN p_status = 'failed' THEN now() ELSE refunded_at END WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_change_withdrawal(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_withdrawal(uuid,text) TO service_role;

-- Confirm full payment before granting a plan; credit balance payments in
-- proportion to the settled crypto amount, capped at the original quote.
CREATE OR REPLACE FUNCTION public.credit_crypto_deposit(p_payment_id text, p_status text, p_actually_paid numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.crypto_deposits; v_uid uuid; v_credit numeric; v_rate numeric;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('waiting','confirming','confirmed','sending','partially_paid','finished','failed','expired','refunded')
    OR p_actually_paid IS NULL OR p_actually_paid < 0 OR p_actually_paid::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid payment'; END IF;
  SELECT user_id INTO v_uid FROM public.crypto_deposits WHERE payment_id = p_payment_id;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
  SELECT * INTO r FROM public.crypto_deposits WHERE payment_id = p_payment_id FOR UPDATE;
  -- Credited records are immutable: late callbacks must not rewrite accounting.
  IF r.credited_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.crypto_deposits SET status = p_status, actually_paid = p_actually_paid, updated_at = now() WHERE id = r.id;
  IF p_status <> 'finished' OR COALESCE(r.pay_amount,0) <= 0 OR p_actually_paid <= 0 THEN RETURN; END IF;
  IF r.purpose = 'plan' THEN
    IF p_actually_paid < r.pay_amount THEN RETURN; END IF;
    v_rate := CASE r.plan_id WHEN 'pro' THEN 0.03 WHEN 'elite' THEN 0.05 ELSE NULL END;
    IF v_rate IS NULL THEN RAISE EXCEPTION 'Invalid plan'; END IF;
    INSERT INTO public.ai_trading_settings(user_id,enabled,plan_id,plan_rate,started_at)
      VALUES(r.user_id,true,r.plan_id,v_rate,now())
      ON CONFLICT(user_id) DO UPDATE SET enabled = true,
        plan_id = CASE WHEN ai_trading_settings.plan_rate <= EXCLUDED.plan_rate THEN EXCLUDED.plan_id ELSE ai_trading_settings.plan_id END,
        plan_rate = GREATEST(ai_trading_settings.plan_rate,EXCLUDED.plan_rate);
  ELSE
    v_credit := round(r.price_amount * LEAST(p_actually_paid / r.pay_amount, 1), 2);
    INSERT INTO public.holdings(user_id,symbol,amount) VALUES(r.user_id,'USD',v_credit)
      ON CONFLICT(user_id,symbol) DO UPDATE SET amount = holdings.amount + EXCLUDED.amount;
  END IF;
  UPDATE public.crypto_deposits SET credited_at = now() WHERE id = r.id;
END $$;
REVOKE ALL ON FUNCTION public.credit_crypto_deposit(text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_crypto_deposit(text,text,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.run_daily_ai_trading_payout()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ai_trading_settings; v_uid uuid; v_profit numeric; v_balance numeric; v_bonus numeric;
  v_today date := (now() AT TIME ZONE 'utc')::date; v_count integer := 0;
BEGIN
  FOR v_uid IN SELECT user_id FROM public.ai_trading_settings WHERE enabled ORDER BY user_id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
    SELECT * INTO r FROM public.ai_trading_settings WHERE user_id = v_uid FOR UPDATE;
    IF NOT r.enabled OR r.last_payout_date >= v_today THEN CONTINUE; END IF;
    SELECT amount INTO v_balance FROM public.holdings WHERE user_id = v_uid AND symbol = 'USD' FOR UPDATE;
    SELECT LEAST(count(*) * 0.005,0.01) INTO v_bonus FROM public.referrals f WHERE f.referrer_id = v_uid
      AND EXISTS(SELECT 1 FROM public.crypto_deposits d WHERE d.user_id = f.referee_id AND d.purpose = 'balance' AND d.credited_at IS NOT NULL);
    v_profit := round(COALESCE(v_balance,0) * (r.plan_rate + v_bonus + CASE WHEN r.boost_date = v_today THEN 0.01 ELSE 0 END),2);
    IF v_profit > 0 THEN
      UPDATE public.holdings SET amount = amount + v_profit WHERE user_id = v_uid AND symbol = 'USD';
      -- A transparent programmed credit, rather than invented market trades.
      INSERT INTO public.ai_trades(user_id,symbol,side,amount,price,profit) VALUES(v_uid,'USD','credit',v_profit,1,v_profit);
    END IF;
    UPDATE public.ai_trading_settings SET last_payout_date = v_today, last_accrued_at = now(),
      daily_rate = plan_rate, boost_date = NULL, total_profit = total_profit + v_profit WHERE user_id = v_uid;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.run_daily_ai_trading_payout() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_ai_trading_payout() TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_ai_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.daily_ai_codes; v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  PERFORM public.ensure_my_account();
  SELECT * INTO r FROM public.daily_ai_codes WHERE code_date = v_today AND code = upper(trim(p_code));
  IF NOT FOUND OR COALESCE(r.sent_at,r.created_at) <= now() - interval '1 hour' THEN
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

CREATE OR REPLACE FUNCTION public.get_my_referral_info()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text; v_count integer; v_active integer;
BEGIN
  PERFORM public.ensure_my_account();
  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = auth.uid();
  IF v_code IS NULL THEN
    LOOP
      v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
      BEGIN
        INSERT INTO public.referral_codes(user_id,code) VALUES(auth.uid(),v_code);
        EXIT;
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
    END LOOP;
  END IF;
  SELECT count(*), count(*) FILTER(WHERE EXISTS(SELECT 1 FROM public.crypto_deposits d
    WHERE d.user_id = f.referee_id AND d.purpose = 'balance' AND d.credited_at IS NOT NULL))
    INTO v_count,v_active FROM public.referrals f WHERE f.referrer_id = auth.uid();
  RETURN jsonb_build_object('ok',true,'code',v_code,'referrals',v_count,'active_referrals',v_active,
    'bonus_rate',LEAST(v_active*0.005,0.01),'invited_by',EXISTS(SELECT 1 FROM public.referrals WHERE referee_id = auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.get_my_referral_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_info() TO authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_ai_codes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_ai_codes() TO service_role;

-- UTC end-of-day payout allows redemption of the 16:00 UTC group code first.
SELECT cron.schedule('gng-daily-payout','55 23 * * *','SELECT public.run_daily_ai_trading_payout();');

-- Initialize existing accounts before revoking browser inserts.
INSERT INTO public.holdings(user_id,symbol,amount) SELECT id,'USD',0 FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.ai_trading_settings(user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.security_settings(user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;

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
  PERFORM public.ensure_my_account();
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


REVOKE INSERT, UPDATE, DELETE ON public.recurring_buys FROM authenticated;

CREATE OR REPLACE FUNCTION public.reserve_deposit(p_user_id uuid,p_currency text,p_amount numeric,p_plan_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.crypto_deposits; v_purpose text := CASE WHEN p_plan_id IS NULL THEN 'balance' ELSE 'plan' END;
BEGIN
  IF p_user_id IS NULL OR p_currency IS NULL OR p_currency NOT IN ('btc','eth','sol','xrp','ltc','doge','trx','bnbbsc','usdttrc20','usdcsol')
    OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000 OR p_amount::text IN ('NaN','Infinity','-Infinity')
    OR (p_plan_id IS NOT NULL AND p_plan_id NOT IN ('pro','elite')) THEN RAISE EXCEPTION 'Invalid deposit'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  -- Timed-out drafts remain recoverable by their order_id if a late signed IPN arrives.
  UPDATE public.crypto_deposits SET status = 'creation_failed', updated_at = now()
    WHERE user_id = p_user_id AND status = 'creating' AND payment_id IS NULL AND created_at < now() - interval '2 minutes';
  SELECT * INTO r FROM public.crypto_deposits WHERE user_id = p_user_id AND pay_currency = p_currency
    AND purpose = v_purpose AND plan_id IS NOT DISTINCT FROM p_plan_id AND price_amount = p_amount
    AND credited_at IS NULL AND status IN ('creating','waiting','confirming','partially_paid') ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('created',false,'deposit',to_jsonb(r)); END IF;
  INSERT INTO public.crypto_deposits(user_id,pay_currency,price_amount,purpose,plan_id)
    VALUES(p_user_id,p_currency,p_amount,v_purpose,p_plan_id) RETURNING * INTO r;
  RETURN jsonb_build_object('created',true,'deposit',to_jsonb(r));
END $$;
REVOKE ALL ON FUNCTION public.reserve_deposit(uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_deposit(uuid,text,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_account_totals()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'users',(SELECT count(*) FROM auth.users),
    'usd',(SELECT COALESCE(sum(amount),0) FROM public.holdings WHERE symbol = 'USD'),
    'deposits',(SELECT count(*) FROM public.crypto_deposits WHERE credited_at IS NOT NULL AND purpose = 'balance'),
    'depositedUsd',(SELECT COALESCE(sum(price_amount * LEAST(actually_paid / NULLIF(pay_amount,0),1)),0) FROM public.crypto_deposits WHERE credited_at IS NOT NULL AND purpose = 'balance'),
    'withdrawals',(SELECT count(*) FROM public.withdrawals),
    'withdrawnUsd',(SELECT COALESCE(sum(usd_value),0) FROM public.withdrawals WHERE status <> 'failed'),
    'aiOn',(SELECT count(*) FROM public.ai_trading_settings WHERE enabled)
  );
$$;
REVOKE ALL ON FUNCTION public.admin_account_totals() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_account_totals() TO service_role;
