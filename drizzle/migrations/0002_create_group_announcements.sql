CREATE TABLE public.group_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'news',
  body text NOT NULL,
  code text,
  code_date date,
  expires_at timestamptz,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.group_announcements TO authenticated;
GRANT ALL ON public.group_announcements TO service_role;
ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_announcements_select ON public.group_announcements FOR SELECT TO authenticated USING (true);