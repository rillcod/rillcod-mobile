import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';

/**
 * Detect Paystack checkout completion inside an in-app WebView.
 * - Supabase paystack-callback (default) or PAYSTACK_CALLBACK_URL on rillcod.com
 * - Paystack success/callback paths on paystack.co
 * - Query ?reference= or ?trxref= matching the initialize reference
 */
export function shouldFinishPaystackWebCheckout(url: string, expectedRef: string): boolean {
  if (!url || url.startsWith('about:')) return false;
  const lower = url.toLowerCase();
  try {
    const parsed = new URL(url);
    const ref = parsed.searchParams.get('reference') || parsed.searchParams.get('trxref');
    if (expectedRef && ref === expectedRef) return true;
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'rillcod.com') return true;
    if (host.endsWith('.supabase.co') && parsed.pathname.includes('paystack-callback')) return true;
    if (host.endsWith('paystack.com') || host.endsWith('paystack.co')) {
      const p = parsed.pathname.toLowerCase();
      if (p.includes('success') || p.includes('callback') || p.includes('complete')) return true;
    }
  } catch {
    /* ignore */
  }
  if (expectedRef && lower.includes(`reference=${encodeURIComponent(expectedRef).toLowerCase()}`)) {
    return true;
  }
  return false;
}

type Props = {
  visible: boolean;
  checkoutUrl: string;
  reference: string;
  onClose: () => void;
  /** Called when we detect a return/success URL or the user taps “I’ve finished paying”. */
  onFinish: () => void;
};

export function PaystackCheckoutModal({ visible, checkoutUrl, reference, onClose, onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const [webLoading, setWebLoading] = useState(true);

  const handleNavChange = useCallback(
    (navState: { url?: string }) => {
      const url = navState.url ?? '';
      if (reference && shouldFinishPaystackWebCheckout(url, reference)) {
        onFinish();
      }
    },
    [reference, onFinish],
  );

  if (!visible || !checkoutUrl) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.shell, { paddingTop: insets.top }]}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={onClose} style={styles.toolbarBtn} hitSlop={12}>
            <Text style={styles.toolbarBtnText}>Close</Text>
          </TouchableOpacity>
          <View style={styles.toolbarTitleWrap}>
            <Text style={styles.toolbarTitle} numberOfLines={1}>
              Rillcod · Paystack
            </Text>
          </View>
          <TouchableOpacity onPress={onFinish} style={styles.toolbarBtn} hitSlop={12}>
            <Text style={[styles.toolbarBtnText, styles.toolbarPrimary]}>I finished paying</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webWrap}>
          {webLoading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : null}
          <WebView
            source={{ uri: checkoutUrl }}
            onLoadStart={() => setWebLoading(true)}
            onLoadEnd={() => setWebLoading(false)}
            onNavigationStateChange={handleNavChange}
            onShouldStartLoadWithRequest={(req) => {
              if (reference && shouldFinishPaystackWebCheckout(req.url, reference)) {
                onFinish();
              }
              return true;
            }}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            setSupportMultipleWindows={false}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: COLORS.bg },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  toolbarTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  toolbarTitle: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 14 },
  toolbarBtn: { paddingHorizontal: 8, paddingVertical: 6, minWidth: 72 },
  toolbarBtnText: { color: COLORS.textMuted, fontSize: 14 },
  toolbarPrimary: { color: COLORS.primary, fontWeight: '600', textAlign: 'right' },
  webWrap: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    zIndex: 1,
  },
});
