-- Per-user read state for `announcements` (no client-only dismiss; data-driven).

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  portal_user_id uuid NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portal_user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id
  ON public.announcement_reads(announcement_id);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcement_reads_select_own"
  ON public.announcement_reads FOR SELECT TO authenticated
  USING (portal_user_id = auth.uid());

CREATE POLICY "announcement_reads_insert_own"
  ON public.announcement_reads FOR INSERT TO authenticated
  WITH CHECK (portal_user_id = auth.uid());

CREATE POLICY "announcement_reads_update_own"
  ON public.announcement_reads FOR UPDATE TO authenticated
  USING (portal_user_id = auth.uid())
  WITH CHECK (portal_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON TABLE public.announcement_reads TO authenticated;
GRANT ALL ON TABLE public.announcement_reads TO service_role;
