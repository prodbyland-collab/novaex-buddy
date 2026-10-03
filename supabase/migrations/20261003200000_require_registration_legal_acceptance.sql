-- Enforce acceptance on new registrations and retain an account-linked receipt.
-- Existing accounts are not required to register again.
CREATE TABLE public.legal_acceptances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legal_acceptances FROM anon, authenticated;
GRANT SELECT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;
CREATE POLICY "Read own legal acceptance" ON public.legal_acceptances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_registration_legal_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data -> 'legal_accepted' IS DISTINCT FROM 'true'::jsonb
     OR NEW.raw_user_meta_data ->> 'terms_version' IS DISTINCT FROM '2026-10-03'
     OR NEW.raw_user_meta_data ->> 'privacy_version' IS DISTINCT FROM '2026-10-03' THEN
    RAISE EXCEPTION 'Registration requires agreement to the current Terms and Conditions and acknowledgement of the Privacy Policy';
  END IF;

  INSERT INTO public.legal_acceptances (user_id, terms_version, privacy_version)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'terms_version', NEW.raw_user_meta_data ->> 'privacy_version');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_registration_legal_acceptance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_registration_legal_acceptance
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_registration_legal_acceptance();
