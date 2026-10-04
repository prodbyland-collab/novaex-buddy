-- Requires secure accounting; balance purchases never count as new deposits.
CREATE TABLE IF NOT EXISTS public.balance_plan_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  plan_id text NOT NULL CHECK (plan_id IN ('pro','elite')),
  price_amount numeric NOT NULL CHECK (price_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id)
);
ALTER TABLE public.balance_plan_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.balance_plan_purchases FROM anon,authenticated;
GRANT SELECT ON public.balance_plan_purchases TO authenticated;
GRANT ALL ON public.balance_plan_purchases TO service_role;
DROP POLICY IF EXISTS balance_plan_owner_read ON public.balance_plan_purchases;
CREATE POLICY balance_plan_owner_read ON public.balance_plan_purchases FOR SELECT TO authenticated
  USING (public.session_is_verified() AND user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.purchase_balance_plan(p_user_id uuid,p_plan_id text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_price numeric; v_rate numeric; v_balance numeric; v_current_rate numeric;
  v_purchase public.balance_plan_purchases;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_plan_id IS NULL OR p_plan_id NOT IN ('pro','elite') THEN
    RAISE EXCEPTION 'Unknown bot plan';
  END IF;
  -- Serialize requests per member, including retries with a different plan.
  PERFORM pg_advisory_xact_lock(hashtextextended('balance-plan:'||p_user_id::text,0));
  SELECT * INTO v_purchase FROM public.balance_plan_purchases
    WHERE user_id=p_user_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_purchase.plan_id<>p_plan_id THEN RAISE EXCEPTION 'Request already used'; END IF;
    RETURN to_jsonb(v_purchase);
  END IF;
  v_price := CASE p_plan_id WHEN 'pro' THEN 250 ELSE 400 END;
  v_rate := CASE p_plan_id WHEN 'pro' THEN .03 ELSE .05 END;
  SELECT amount INTO v_balance FROM public.holdings WHERE user_id=p_user_id AND symbol='USD' FOR UPDATE;
  SELECT plan_rate INTO v_current_rate FROM public.ai_trading_settings WHERE user_id=p_user_id FOR UPDATE;
  IF COALESCE(v_current_rate,.01)>=v_rate THEN RAISE EXCEPTION 'This plan or a higher tier is already active'; END IF;
  IF COALESCE(v_balance,0)<v_price THEN RAISE EXCEPTION 'Insufficient USD balance'; END IF;
  UPDATE public.holdings SET amount=amount-v_price WHERE user_id=p_user_id AND symbol='USD';
  INSERT INTO public.ai_trading_settings(user_id,enabled,plan_id,plan_rate,started_at)
    VALUES(p_user_id,true,p_plan_id,v_rate,now())
    ON CONFLICT(user_id) DO UPDATE SET enabled=true,plan_id=EXCLUDED.plan_id,plan_rate=EXCLUDED.plan_rate,
      started_at=COALESCE(ai_trading_settings.started_at,EXCLUDED.started_at);
  INSERT INTO public.balance_plan_purchases(user_id,request_id,plan_id,price_amount)
    VALUES(p_user_id,p_request_id,p_plan_id,v_price) RETURNING * INTO v_purchase;
  RETURN to_jsonb(v_purchase);
END $$;
REVOKE ALL ON FUNCTION public.purchase_balance_plan(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_balance_plan(uuid,text,uuid) TO service_role;
