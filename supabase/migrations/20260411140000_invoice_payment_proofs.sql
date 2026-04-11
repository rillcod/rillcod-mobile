-- Proof-of-transfer images for bank payments (stored in R2; URL saved here).
-- Parents/students submit; admins and same-school staff can review.

CREATE TABLE IF NOT EXISTS public.invoice_payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  proof_image_url text NOT NULL,
  payer_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_proofs_invoice_id
  ON public.invoice_payment_proofs(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_proofs_submitted_by
  ON public.invoice_payment_proofs(submitted_by);

ALTER TABLE public.invoice_payment_proofs ENABLE ROW LEVEL SECURITY;

-- Payer (student on own invoice, or parent) may insert when invoice is theirs / child’s.
CREATE POLICY "invoice_payment_proofs_insert_by_payer"
  ON public.invoice_payment_proofs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
      AND (
        i.portal_user_id = auth.uid()
        OR (
          public.is_parent()
          AND i.portal_user_id IN (SELECT public.get_parent_child_user_ids())
        )
      )
    )
  );

-- Submitter can read their own submissions.
CREATE POLICY "invoice_payment_proofs_select_own"
  ON public.invoice_payment_proofs
  FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

-- Admins see all.
CREATE POLICY "invoice_payment_proofs_select_admin"
  ON public.invoice_payment_proofs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- School + teacher: proofs for invoices belonging to their school.
CREATE POLICY "invoice_payment_proofs_select_school_staff"
  ON public.invoice_payment_proofs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices inv
      JOIN public.portal_users pu ON pu.id = auth.uid()
      WHERE inv.id = invoice_id
        AND inv.school_id IS NOT NULL
        AND pu.school_id = inv.school_id
        AND pu.role IN ('school', 'teacher')
    )
  );

GRANT SELECT, INSERT ON TABLE public.invoice_payment_proofs TO authenticated;
GRANT ALL ON TABLE public.invoice_payment_proofs TO service_role;
