import { Linking, Alert } from 'react-native';
import { companyInfo, contactInfo } from '../constants/brand';

export function buildBankTransferProofWhatsAppMessage(params: {
  invoiceNumber: string;
  amountLabel: string;
  proofUrl: string;
  payerName?: string | null;
}): string {
  const who = params.payerName?.trim() ? `Payer: ${params.payerName.trim()}\n` : '';
  return (
    `Bank transfer proof — ${companyInfo.name}\n` +
    `Invoice: ${params.invoiceNumber}\n` +
    `Amount: ${params.amountLabel}\n` +
    who +
    `Proof (open link): ${params.proofUrl}\n` +
    `(Sent from Rillcod app)`
  );
}

/** Opens company WhatsApp with pre-filled proof message (wa.me from brand config). */
export async function openCompanyWhatsAppWithProofMessage(message: string): Promise<void> {
  const base = contactInfo.whatsapp.replace(/\/?$/, '');
  const url = `${base}?text=${encodeURIComponent(message)}`;
  try {
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert('WhatsApp', 'Cannot open WhatsApp on this device.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('WhatsApp', 'Unable to open WhatsApp.');
  }
}
