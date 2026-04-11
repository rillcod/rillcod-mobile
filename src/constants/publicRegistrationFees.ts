/**
 * Display amounts for public registration (keep in sync with
 * `supabase/functions/paystack-initialize-public-registration` defaults / env).
 */
export function publicRegistrationFeeNgn(enrollmentType: string): number {
  switch (String(enrollmentType || '').toLowerCase()) {
    case 'school':
      return 17500;
    case 'bootcamp':
      return 42500;
    case 'online':
      return 32500;
    case 'in_person':
      return 50000;
    default:
      return 25000;
  }
}

export function formatNgn(amount: number): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `₦${Math.round(amount)}`;
  }
}
