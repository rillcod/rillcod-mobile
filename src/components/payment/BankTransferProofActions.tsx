import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { paymentService } from '../../services/payment.service';
import { uploadToR2, mimeFromExt } from '../../lib/r2';
import {
  buildBankTransferProofWhatsAppMessage,
  openCompanyWhatsAppWithProofMessage,
} from '../../lib/paymentProofWhatsApp';
import { FONT_FAMILY, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

function extFromUri(uri: string): string {
  const m = uri.match(/\.(\w+)(?:\?|$)/);
  return (m?.[1] ?? 'jpg').toLowerCase();
}

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  /** Called after edge records proof + ledger (e.g. refresh invoices). */
  onRecorded?: () => void;
};

export function BankTransferProofActions({ invoiceId, invoiceNumber, amount, currency, onRecorded }: Props) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => makeStyles(), []);

  const amountLabel = useMemo(
    () =>
      new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: currency || 'NGN',
        minimumFractionDigits: 0,
      }).format(amount),
    [amount, currency],
  );

  const runPick = async (source: 'camera' | 'library') => {
    if (!profile?.id) {
      Alert.alert('Sign in', 'You need to be signed in to upload proof.');
      return;
    }

    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Permission needed',
        source === 'camera' ? 'Camera access is required.' : 'Photo library access is required.',
      );
      return;
    }

    const picker =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
            allowsEditing: false,
          });

    if (picker.canceled || !picker.assets?.length) return;

    const asset = picker.assets[0];
    const uri = asset.uri;
    const ext = extFromUri(uri);
    const contentType = asset.mimeType ?? mimeFromExt(ext);
    const key = `payment-proofs/${invoiceId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    setBusy(true);
    try {
      const publicUrl = await uploadToR2(uri, key, contentType);
      const res = await paymentService.submitBankTransferProofAfterUpload({
        invoiceId,
        proofImageUrl: publicUrl,
        payerNote: null,
      });
      onRecorded?.();
      const msg = buildBankTransferProofWhatsAppMessage({
        invoiceNumber,
        amountLabel,
        proofUrl: publicUrl,
        payerName: profile.full_name,
      });
      const sub =
        res?.duplicate === true
          ? 'We already had this proof on file.'
          : 'A pending receipt was added to our ledger. Finance will verify your transfer; your invoice stays open until then.';
      Alert.alert(res?.duplicate ? 'Already submitted' : 'Proof recorded', `${sub} Send the link on WhatsApp so we can match you quickly.`, [
        { text: 'Later', style: 'cancel' },
        { text: 'Open WhatsApp', onPress: () => void openCompanyWhatsAppWithProofMessage(msg) },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not upload proof.';
      Alert.alert('Upload failed', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>BANK TRANSFER PROOF</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>
        Pay into the account details above, then upload a clear photo of your receipt. We store it on Cloudflare and create a
        pending ledger entry. WhatsApp the same link to Rillcod so accounts can verify you; your invoice updates once they
        confirm.
      </Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, { borderColor: colors.primary, backgroundColor: colors.primary }]}
          disabled={busy}
          onPress={() => void runPick('camera')}
          activeOpacity={0.88}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimary}>Camera</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnGhostWrap, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
          disabled={busy}
          onPress={() => void runPick('library')}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnGhost, { color: colors.textPrimary }]}>Upload photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    wrap: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
    title: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, letterSpacing: LETTER_SPACING.wider, marginBottom: 6 },
    sub: { fontFamily: FONT_FAMILY.body, fontSize: 12, lineHeight: 18, marginBottom: SPACING.md },
    row: { flexDirection: 'row', gap: SPACING.sm },
    btn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    btnGhostWrap: {
      borderWidth: 2,
    },
    btnPrimary: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, color: '#fff' },
    btnGhost: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 13 },
  });
}
