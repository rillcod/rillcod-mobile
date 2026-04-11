-- Finance console: admins see all; school partners see/update rows for their school.
-- Uses SECURITY DEFINER helpers only — no EXISTS on portal_users in policies (avoids RLS recursion).

DROP POLICY IF EXISTS "payment_transactions_select_finance_staff" ON public.payment_transactions;
CREATE POLICY "payment_transactions_select_finance_staff"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      public.get_my_role() = 'school'
      AND public.get_my_school_id() IS NOT NULL
      AND payment_transactions.school_id IS NOT NULL
      AND payment_transactions.school_id = public.get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "payment_transactions_update_finance_staff" ON public.payment_transactions;
CREATE POLICY "payment_transactions_update_finance_staff"
  ON public.payment_transactions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      public.get_my_role() = 'school'
      AND public.get_my_school_id() IS NOT NULL
      AND payment_transactions.school_id IS NOT NULL
      AND payment_transactions.school_id = public.get_my_school_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.get_my_role() = 'school'
      AND public.get_my_school_id() IS NOT NULL
      AND payment_transactions.school_id IS NOT NULL
      AND payment_transactions.school_id = public.get_my_school_id()
    )
  );
