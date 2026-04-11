-- Public student registration: record Paystack fee confirmation on the interest row.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS registration_payment_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS registration_paystack_reference text NULL;

COMMENT ON COLUMN public.students.registration_payment_at IS 'Set when the public registration fee invoice is paid (Paystack webhook / verify).';
COMMENT ON COLUMN public.students.registration_paystack_reference IS 'Paystack transaction reference for the registration fee payment.';
