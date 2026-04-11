import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { paymentService } from '../services/payment.service';
import { PaystackCheckoutModal } from '../components/payments/PaystackCheckoutModal';

type InitializeOk = {
  authorization_url: string;
  reference: string;
  access_code?: string;
};

export type PaystackFulfilledInfo = {
  reference: string;
  alreadyDone?: boolean;
};

export type UsePaystackOptions = {
  onFulfilled?: (info: PaystackFulfilledInfo) => void;
  showSuccessAlert?: boolean;
};

async function readInvokeErrorMessage(error: { message: string; context?: Response }): Promise<string> {
  let msg = error.message;
  try {
    const body = await error.context?.json();
    if (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
      msg = (body as { error: string }).error;
    }
  } catch {
    /* keep message */
  }
  return msg;
}

/**
 * Paystack: in-app WebView checkout + verify when the session completes or the app resumes.
 * Render `PaystackCheckoutPortal` once per screen (or at app root).
 */
export function usePaystack(options?: UsePaystackOptions) {
  const [loading, setLoading] = useState(false);
  const [checkoutSession, setCheckoutSession] = useState<{ url: string; ref: string } | null>(null);
  const pendingReferenceRef = useRef<string | null>(null);
  const onFulfilledRef = useRef(options?.onFulfilled);
  const showSuccessAlertRef = useRef(options?.showSuccessAlert !== false);
  onFulfilledRef.current = options?.onFulfilled;
  showSuccessAlertRef.current = options?.showSuccessAlert !== false;

  const verifyInFlightRef = useRef(false);
  /** `fromCheckoutFinish`: user returned from Paystack success URL — show guidance if verify still pending. */
  const runVerifyForPending = useCallback(async (ref: string, fromCheckoutFinish = false) => {
    if (verifyInFlightRef.current) return;
    verifyInFlightRef.current = true;
    const delaysMs = [0, 1800, 4000];
    try {
      for (let i = 0; i < delaysMs.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, delaysMs[i] - delaysMs[i - 1]));
        try {
          const res = await paymentService.verifyPaystackReference(ref);
          if (res?.fulfilled) {
            pendingReferenceRef.current = null;
            setCheckoutSession(null);
            if (showSuccessAlertRef.current) {
              Alert.alert(
                'Payment successful',
                res.alreadyDone
                  ? 'This payment was already recorded for this invoice (receipt on file if applicable).'
                  : 'Your payment was received. The invoice is marked paid and a receipt was saved for this transaction.',
                [{ text: 'OK' }],
              );
            }
            onFulfilledRef.current?.({ reference: ref, alreadyDone: !!res.alreadyDone });
            return;
          }
        } catch {
          /* try next delay */
        }
      }
      if (fromCheckoutFinish && showSuccessAlertRef.current) {
        Alert.alert(
          'Payment not confirmed yet',
          'Your bank may still be processing the transfer. Reopen this screen or refresh invoices in a moment. If the charge cleared but the invoice still shows unpaid, contact support with your Paystack reference.',
          [{ text: 'OK' }],
        );
      }
    } finally {
      verifyInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next !== 'active' || !pendingReferenceRef.current) return;
      const ref = pendingReferenceRef.current;
      void runVerifyForPending(ref, false);
    };

    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [runVerifyForPending]);

  const startCheckoutForInvoice = useCallback(async (invoiceId: string): Promise<InitializeOk | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<InitializeOk>('paystack-initialize', {
        body: { invoice_id: invoiceId },
      });

      if (error) {
        const msg = await readInvokeErrorMessage(error);
        Alert.alert('Paystack', msg);
        return null;
      }

      if (!data?.authorization_url || !data.reference) {
        const fallback = (data as { error?: string } | null)?.error ?? 'No checkout URL returned';
        Alert.alert('Paystack', fallback);
        return null;
      }

      pendingReferenceRef.current = data.reference;
      setCheckoutSession({ url: data.authorization_url, ref: data.reference });
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed to start';
      Alert.alert('Paystack', msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const closeCheckout = useCallback(() => {
    setCheckoutSession(null);
    pendingReferenceRef.current = null;
  }, []);

  const finishCheckout = useCallback(() => {
    const ref = pendingReferenceRef.current;
    setCheckoutSession(null);
    if (ref) void runVerifyForPending(ref, true);
  }, [runVerifyForPending]);

  const syncCheckoutByReference = useCallback(async (reference: string) => {
    try {
      const res = await paymentService.verifyPaystackReference(reference);
      if (res?.fulfilled) {
        if (showSuccessAlertRef.current) {
          Alert.alert(
            'Payment successful',
            'This invoice is marked as paid. A receipt is saved for this transaction when applicable.',
            [{ text: 'OK' }],
          );
        }
        onFulfilledRef.current?.({ reference, alreadyDone: !!res.alreadyDone });
      }
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not verify payment';
      Alert.alert('Paystack', msg);
      return null;
    }
  }, []);

  const PaystackCheckoutPortal = useCallback(
    () => (
      <PaystackCheckoutModal
        visible={checkoutSession !== null}
        checkoutUrl={checkoutSession?.url ?? ''}
        reference={checkoutSession?.ref ?? ''}
        onClose={closeCheckout}
        onFinish={finishCheckout}
      />
    ),
    [checkoutSession, closeCheckout, finishCheckout],
  );

  return {
    startCheckoutForInvoice,
    syncCheckoutByReference,
    loading,
    publicKey: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY,
    PaystackCheckoutPortal,
  };
}
