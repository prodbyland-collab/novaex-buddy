-- Apply after the secure accounting and ten-minute group code migrations.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL,
  actor_label text NOT NULL, target_id uuid, target_label text,
  action text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
  outcome text NOT NULL DEFAULT 'completed' CHECK (outcome IN ('pending','completed','failed')),
  error_message text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_audit_created ON public.admin_audit_log(created_at DESC,id DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM anon,authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
DROP POLICY IF EXISTS admin_audit_read ON public.admin_audit_log;
CREATE POLICY admin_audit_read ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.session_is_verified() AND public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.member_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('deposit','plan','code','payout')),
  event_key text NOT NULL UNIQUE, details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS member_notifications_owner ON public.member_notifications(user_id,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS public.notification_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES public.member_notifications(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,notification_id)
);
ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_notifications,public.notification_reads FROM anon,authenticated;
GRANT SELECT ON public.member_notifications,public.notification_reads TO authenticated;
GRANT ALL ON public.member_notifications,public.notification_reads TO service_role;
DROP POLICY IF EXISTS notifications_owner_read ON public.member_notifications;
CREATE POLICY notifications_owner_read ON public.member_notifications FOR SELECT TO authenticated
 USING (public.session_is_verified() AND (user_id = auth.uid() OR user_id IS NULL) AND (expires_at IS NULL OR expires_at > now()));
DROP POLICY IF EXISTS notification_receipts_owner ON public.notification_reads;
CREATE POLICY notification_receipts_owner ON public.notification_reads FOR SELECT TO authenticated
 USING (public.session_is_verified() AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.session_is_verified() THEN RAISE EXCEPTION 'Authentication verification required'; END IF;
  IF cardinality(p_ids) > 100 THEN RAISE EXCEPTION 'Too many notification IDs'; END IF;
  INSERT INTO public.notification_reads(user_id,notification_id)
  SELECT auth.uid(),n.id FROM public.member_notifications n
    WHERE (n.user_id IS NULL OR n.user_id=auth.uid()) AND (p_ids IS NULL OR n.id=ANY(p_ids))
      AND (n.expires_at IS NULL OR n.expires_at>now())
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;

-- These triggers share the financial transaction: retries never duplicate alerts.
CREATE OR REPLACE FUNCTION public.notify_account_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_TABLE_NAME='crypto_deposits' THEN
    IF OLD.credited_at IS NULL AND NEW.credited_at IS NOT NULL AND NEW.purpose='balance' THEN
      INSERT INTO public.member_notifications(user_id,kind,event_key,details)
      VALUES(NEW.user_id,'deposit','deposit:'||NEW.id,jsonb_build_object('amount',NEW.price_amount * LEAST(COALESCE(NEW.actually_paid,0)/NULLIF(NEW.pay_amount,0),1),'currency','USD','paymentId',NEW.payment_id))
      ON CONFLICT(event_key) DO NOTHING;
    END IF;
  ELSIF TG_TABLE_NAME='ai_trading_settings' THEN
    IF (TG_OP='UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id) OR (TG_OP='INSERT' AND NEW.plan_id<>'free') THEN
      INSERT INTO public.member_notifications(user_id,kind,event_key,details)
      VALUES(NEW.user_id,'plan','plan:'||gen_random_uuid(),jsonb_build_object('plan',NEW.plan_id,'rate',NEW.plan_rate))
      ON CONFLICT(event_key) DO NOTHING;
    END IF;
    IF NEW.last_payout_date IS NOT NULL AND NEW.last_payout_date IS DISTINCT FROM OLD.last_payout_date THEN
      INSERT INTO public.member_notifications(user_id,kind,event_key,details)
      VALUES(NEW.user_id,'payout','payout:'||NEW.user_id||':'||NEW.last_payout_date,jsonb_build_object('amount',NEW.total_profit-COALESCE(OLD.total_profit,0),'date',NEW.last_payout_date))
      ON CONFLICT(event_key) DO NOTHING;
    END IF;
  ELSIF TG_TABLE_NAME='group_announcements' THEN
    IF NEW.kind='code' THEN
      INSERT INTO public.member_notifications(kind,event_key,details,expires_at)
      VALUES('code','code:'||NEW.id,jsonb_build_object('code',NEW.code,'date',NEW.code_date),NEW.expires_at)
      ON CONFLICT(event_key) DO UPDATE SET details=EXCLUDED.details,expires_at=EXCLUDED.expires_at;
      -- Rotating a code makes that same notification unread again.
      IF TG_OP='UPDATE' AND NEW.code IS DISTINCT FROM OLD.code THEN
        DELETE FROM public.notification_reads WHERE notification_id=(SELECT id FROM public.member_notifications WHERE event_key='code:'||NEW.id);
        UPDATE public.member_notifications SET created_at=now() WHERE event_key='code:'||NEW.id;
      END IF;
    ELSIF NEW.kind='news' AND NEW.author_id IS NOT NULL AND TG_OP='INSERT' THEN
      INSERT INTO public.admin_audit_log(actor_id,actor_label,target_id,action,details,completed_at)
      VALUES(NEW.author_id,COALESCE((SELECT to_jsonb(u)->>'email' FROM auth.users u WHERE u.id=NEW.author_id),NEW.author_id::text),NEW.id,'announcement.publish',jsonb_build_object('characters',length(NEW.body)),now());
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_account_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS notify_deposit ON public.crypto_deposits;
CREATE TRIGGER notify_deposit AFTER UPDATE ON public.crypto_deposits FOR EACH ROW EXECUTE FUNCTION public.notify_account_event();
DROP TRIGGER IF EXISTS notify_plan ON public.ai_trading_settings;
CREATE TRIGGER notify_plan AFTER INSERT OR UPDATE ON public.ai_trading_settings FOR EACH ROW EXECUTE FUNCTION public.notify_account_event();
DROP TRIGGER IF EXISTS notify_group ON public.group_announcements;
CREATE TRIGGER notify_group AFTER INSERT OR UPDATE ON public.group_announcements FOR EACH ROW EXECUTE FUNCTION public.notify_account_event();

-- Administrator mutations and their audit record commit or roll back together.
CREATE OR REPLACE FUNCTION public.perform_admin_action(p_actor uuid,p_action text,p_target uuid DEFAULT NULL,p_details jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before jsonb; v_result jsonb := '{}'; v_rate numeric; v_count integer; v_code text; v_actor text; v_target text;
BEGIN
  IF NOT public.has_role(p_actor,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT COALESCE(to_jsonb(u)->>'email',u.id::text) INTO v_actor FROM auth.users u WHERE u.id=p_actor;
  SELECT COALESCE(to_jsonb(u)->>'email',u.id::text) INTO v_target FROM auth.users u WHERE u.id=p_target;
  CASE p_action
    WHEN 'balance.set','balance.adjust' THEN
      SELECT jsonb_build_object('amount',amount,'symbol',symbol) INTO v_before FROM public.holdings WHERE user_id=p_target AND symbol=p_details->>'symbol' FOR UPDATE;
      v_result := jsonb_build_object('amount',public.admin_change_balance(p_target,p_details->>'symbol',(p_details->>'value')::numeric,p_action='balance.set'));
    WHEN 'plan.set' THEN
      SELECT jsonb_build_object('plan',plan_id,'enabled',enabled) INTO v_before FROM public.ai_trading_settings WHERE user_id=p_target FOR UPDATE;
      v_rate := CASE p_details->>'plan' WHEN 'free' THEN .01 WHEN 'pro' THEN .03 WHEN 'elite' THEN .05 ELSE NULL END;
      IF v_rate IS NULL THEN RAISE EXCEPTION 'Unknown plan'; END IF;
      INSERT INTO public.ai_trading_settings(user_id,plan_id,plan_rate,enabled) VALUES(p_target,p_details->>'plan',v_rate,(p_details->>'enabled')::boolean)
      ON CONFLICT(user_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,plan_rate=EXCLUDED.plan_rate,enabled=EXCLUDED.enabled;
    WHEN 'boost.set' THEN
      SELECT jsonb_build_object('date',boost_date) INTO v_before FROM public.ai_trading_settings WHERE user_id=p_target FOR UPDATE;
      INSERT INTO public.ai_trading_settings(user_id,boost_date) VALUES(p_target,CASE WHEN (p_details->>'grant')::boolean THEN (now() AT TIME ZONE 'utc')::date ELSE NULL END)
      ON CONFLICT(user_id) DO UPDATE SET boost_date=EXCLUDED.boost_date;
    WHEN 'role.set' THEN
      IF p_target=p_actor AND NOT (p_details->>'admin')::boolean THEN RAISE EXCEPTION 'You cannot remove your own admin access'; END IF;
      v_before := jsonb_build_object('admin',public.has_role(p_target,'admin'));
      IF (p_details->>'admin')::boolean THEN INSERT INTO public.user_roles(user_id,role) VALUES(p_target,'admin') ON CONFLICT DO NOTHING;
      ELSE DELETE FROM public.user_roles WHERE user_id=p_target AND role='admin'; END IF;
    WHEN 'withdrawal.status' THEN
      SELECT jsonb_build_object('status',status,'userId',user_id) INTO v_before FROM public.withdrawals WHERE id=p_target FOR UPDATE;
      PERFORM public.admin_change_withdrawal(p_target,p_details->>'status');
    WHEN 'deposit.reject' THEN
      SELECT jsonb_build_object('status',status,'userId',user_id) INTO v_before FROM public.crypto_deposits WHERE id=p_target FOR UPDATE;
      UPDATE public.crypto_deposits SET status='failed' WHERE id=p_target AND credited_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Deposit is missing or already credited'; END IF;
    WHEN 'deposit.credit' THEN
      SELECT jsonb_build_object('status',status,'userId',user_id) INTO v_before FROM public.crypto_deposits WHERE id=p_target FOR UPDATE;
      IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.crypto_deposits WHERE id=p_target AND payment_id=p_details->>'paymentId' AND credited_at IS NULL) THEN RAISE EXCEPTION 'Deposit is missing or already credited'; END IF;
      PERFORM public.credit_crypto_deposit(p_details->>'paymentId','finished',(p_details->>'paid')::numeric);
    WHEN 'announcement.delete' THEN
      DELETE FROM public.group_announcements WHERE id=p_target AND kind='news';
      IF NOT FOUND THEN RAISE EXCEPTION 'Announcement not found'; END IF;
    WHEN 'code.rotate' THEN v_code := public.rotate_daily_group_code(); v_result := jsonb_build_object('code',v_code);
    WHEN 'payout.run' THEN v_count := public.run_daily_ai_trading_payout(); v_result := jsonb_build_object('paid',v_count);
    ELSE RAISE EXCEPTION 'Unknown administrator action';
  END CASE;
  INSERT INTO public.admin_audit_log(actor_id,actor_label,target_id,target_label,action,details,completed_at)
  VALUES(p_actor,v_actor,p_target,v_target,p_action,jsonb_build_object('before',v_before,'requested',p_details,'result',v_result),now());
  RETURN v_result || jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.perform_admin_action(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.perform_admin_action(uuid,text,uuid,jsonb) TO service_role;

-- Auth-provider operations keep a durable intent even if the provider/worker fails.
CREATE OR REPLACE FUNCTION public.begin_admin_auth_action(p_actor uuid,p_target uuid,p_action text,p_details jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_actor text; v_target text;
BEGIN
  IF NOT public.has_role(p_actor,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_actor=p_target THEN RAISE EXCEPTION 'You cannot change your own account access'; END IF;
  IF p_action NOT IN ('account.delete','account.suspend','account.restore') THEN RAISE EXCEPTION 'Invalid auth action'; END IF;
  SELECT COALESCE(to_jsonb(u)->>'email',u.id::text) INTO v_actor FROM auth.users u WHERE u.id=p_actor;
  SELECT COALESCE(to_jsonb(u)->>'email',u.id::text) INTO v_target FROM auth.users u WHERE u.id=p_target;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  INSERT INTO public.admin_audit_log(actor_id,actor_label,target_id,target_label,action,details,outcome)
  VALUES(p_actor,v_actor,p_target,v_target,p_action,p_details,'pending') RETURNING id INTO v_id;
  RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.finish_admin_auth_action(p_id uuid,p_success boolean,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.admin_audit_log SET outcome=CASE WHEN p_success THEN 'completed' ELSE 'failed' END,error_message=left(p_error,300),completed_at=now()
  WHERE id=p_id AND outcome='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Audit intent not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.begin_admin_auth_action(uuid,uuid,text,jsonb),public.finish_admin_auth_action(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_admin_auth_action(uuid,uuid,text,jsonb),public.finish_admin_auth_action(uuid,boolean,text) TO service_role;
NOTIFY pgrst,'reload schema';
