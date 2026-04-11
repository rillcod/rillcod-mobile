import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { paymentService, type InvoiceInsert, type ReceiptInsert } from '../../services/payment.service';
import { schoolService } from '../../services/school.service';
import { studentService } from '../../services/student.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import type { Json } from '../../types/supabase';

type DocKind = 'invoice' | 'receipt';
type Audience = 'portal' | 'registration';
type LineItem = { description: string; quantity: number; unit_price: number; total: number };

type PortalRow = { id: string; full_name: string; email: string; school_id: string | null };
type RegRow = {
  id: string;
  display_name: string;
  email: string;
  school_id: string | null;
  school_name: string | null;
  parent_email: string | null;
};

function uidBatch(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

function nextInvoiceNo(index: number) {
  return `INV-${Date.now().toString(36).toUpperCase()}-${index + 1}-${Math.random().toString(36).slice(2, 5)}`;
}

function nextReceiptNo(index: number) {
  return `RCPT-${Date.now().toString(36).toUpperCase()}-${index + 1}`;
}

export default function BulkPaymentsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const isAdmin = profile?.role === 'admin';
  const isSchool = profile?.role === 'school';

  const [tab, setTab] = useState<'generate' | 'archive'>('generate');
  const [docKind, setDocKind] = useState<DocKind>('invoice');
  const [audience, setAudience] = useState<Audience>('portal');
  const [schoolId, setSchoolId] = useState<string>('');
  const [schoolOptions, setSchoolOptions] = useState<{ id: string; name: string }[]>([]);
  const [portalRows, setPortalRows] = useState<PortalRow[]>([]);
  const [regRows, setRegRows] = useState<RegRow[]>([]);
  const [accounts, setAccounts] = useState<
    { id: string; label: string; bank_name: string; account_number: string; account_name: string }[]
  >([]);
  const [accountIndex, setAccountIndex] = useState(0);
  const [pickQuery, setPickQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
  const [dueDate, setDueDate] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<'sent' | 'draft'>('sent');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [referencePrefix, setReferencePrefix] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [archiveInvoices, setArchiveInvoices] = useState<any[]>([]);
  const [archiveReceipts, setArchiveReceipts] = useState<any[]>([]);

  const effectiveSchoolId = isSchool ? profile?.school_id ?? '' : schoolId;

  useEffect(() => {
    if (docKind === 'invoice' && audience === 'registration') {
      setAudience('portal');
    }
  }, [docKind, audience]);

  const loadArchive = useCallback(async () => {
    if (!profile) return;
    try {
      const [inv, rec] = await Promise.all([
        paymentService.listBulkTaggedInvoices({
          isAdmin,
          schoolId: profile.school_id,
          limit: 200,
        }),
        paymentService.listReceiptsForFinanceConsole(200),
      ]);
      setArchiveInvoices(inv);
      const batches = paymentService.groupReceiptsByBatchId(rec as { metadata: Json | null }[]);
      setArchiveReceipts(
        Array.from(batches.entries()).map(([batch_id, count]) => ({ batch_id, count })),
      );
    } catch (e) {
      console.warn('BulkPayments archive', e);
    }
  }, [profile, isAdmin]);

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [schoolRows, acc] = await Promise.all([
        isAdmin ? schoolService.listApprovedSchoolOptions() : Promise.resolve([] as { id: string; name: string }[]),
        paymentService.listPaymentAccounts({ isAdmin, schoolId: profile.school_id }),
      ]);
      setSchoolOptions(schoolRows);
      setAccounts(
        (acc ?? []).map((a: any) => ({
          id: a.id,
          label: a.label,
          bank_name: a.bank_name,
          account_number: a.account_number,
          account_name: a.account_name,
        })),
      );
      if (isSchool && profile.school_id) setSchoolId(profile.school_id);
      await loadArchive();
    } catch (e) {
      console.warn('BulkPayments load', e);
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin, isSchool, loadArchive]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'archive') void loadArchive();
  }, [tab, loadArchive]);

  const loadRecipients = useCallback(async () => {
    const sid = effectiveSchoolId || undefined;
    if (isAdmin && !sid) {
      setPortalRows([]);
      setRegRows([]);
      return;
    }
    if (!sid && !isAdmin) return;
    try {
      if (audience === 'portal') {
        const rows = await studentService.listActiveStudentsForBilling({
          schoolId: isAdmin ? sid : profile?.school_id,
          limit: 400,
        });
        setPortalRows(rows as PortalRow[]);
      } else {
        const rows = await studentService.listRegistrationStudentsForBilling({
          schoolId: isAdmin ? sid : profile?.school_id,
          limit: 400,
        });
        setRegRows(rows);
      }
      setSelected(new Set());
    } catch (e) {
      console.warn('BulkPayments recipients', e);
      Alert.alert('Recipients', 'Could not load the student list.');
    }
  }, [audience, effectiveSchoolId, isAdmin, profile?.school_id]);

  useEffect(() => {
    if (tab !== 'generate') return;
    if (isAdmin && !effectiveSchoolId) return;
    void loadRecipients();
  }, [tab, audience, effectiveSchoolId, isAdmin, loadRecipients]);

  const displayRows = audience === 'portal' ? portalRows : regRows;

  const filteredPick = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return displayRows;
    if (audience === 'portal') {
      return portalRows.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.school_id && r.school_id.toLowerCase().includes(q)),
      );
    }
    return regRows.filter(
      (r) =>
        r.display_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.parent_email && r.parent_email.toLowerCase().includes(q)),
    );
  }, [audience, pickQuery, portalRows, regRows, displayRows]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filteredPick.map((r: any) => r.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index], ...patch };
      const qty = Number(row.quantity) || 1;
      const unit = Number(row.unit_price) || 0;
      row.quantity = qty;
      row.unit_price = unit;
      row.total = qty * unit;
      next[index] = row;
      return next;
    });
  };

  const addItem = () => setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  const removeItem = (index: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const runBulk = async () => {
    const validItems = items.filter((i) => i.description.trim() && i.unit_price > 0);
    if (!effectiveSchoolId) {
      Alert.alert('School', isAdmin ? 'Choose a school first.' : 'Your account is not linked to a school.');
      return;
    }
    if (selected.size === 0) {
      Alert.alert('Recipients', 'Select at least one student.');
      return;
    }
    if (validItems.length === 0) {
      Alert.alert('Line items', 'Add at least one line with description and unit price.');
      return;
    }
    const amount = validItems.reduce((s, i) => s + i.total, 0);
    const batchId = uidBatch();
    const bulkTag = `BULK-${batchId}`;
    const noteBase = [notes.trim(), bulkTag].filter(Boolean).join(' · ');
    const deposit =
      accounts[accountIndex] != null
        ? {
            bank_name: accounts[accountIndex].bank_name,
            account_number: accounts[accountIndex].account_number,
            account_name: accounts[accountIndex].account_name,
          }
        : null;

    setRunning(true);
    try {
      if (docKind === 'invoice') {
        const ids = Array.from(selected);
        const rows: InvoiceInsert[] = ids.map((id, index) => {
          const st = portalRows.find((p) => p.id === id);
          if (!st) throw new Error('Missing portal student row');
          return {
            invoice_number: nextInvoiceNo(index),
            portal_user_id: id,
            school_id: st.school_id ?? effectiveSchoolId,
            amount,
            currency: 'NGN',
            status: invoiceStatus,
            due_date: dueDate.trim() || null,
            notes: noteBase,
            items: validItems as unknown as Json,
          };
        });
        await paymentService.createBulkInvoices(rows);
        Alert.alert('Bulk invoices', `${rows.length} invoices created.`);
      } else {
        const ids = Array.from(selected);
        const rows: ReceiptInsert[] = ids.map((id, index) => {
          if (audience === 'portal') {
            const st = portalRows.find((p) => p.id === id);
            return {
              receipt_number: nextReceiptNo(index),
              amount,
              currency: 'NGN',
              school_id: effectiveSchoolId,
              student_id: id,
              transaction_id: null,
              metadata: {
                batch_id: batchId,
                payer_type: 'student',
                payer_name: st?.full_name ?? null,
                payment_method: paymentMethod,
                payment_date: paymentDate,
                reference: `${referencePrefix || 'BULK'}-${batchId}-${index + 1}`,
                received_by: profile?.full_name || 'Accounts Team',
                notes: notes.trim() || null,
                items: validItems,
                deposit_account: deposit,
              } as Json,
            };
          }
          const st = regRows.find((r) => r.id === id);
          return {
            receipt_number: nextReceiptNo(index),
            amount,
            currency: 'NGN',
            school_id: effectiveSchoolId,
            student_id: null,
            transaction_id: null,
            metadata: {
              batch_id: batchId,
              payer_type: 'student',
              registration_student_id: id,
              payer_name: st?.display_name ?? null,
              parent_email: st?.parent_email ?? null,
              payment_method: paymentMethod,
              payment_date: paymentDate,
              reference: `${referencePrefix || 'BULK'}-${batchId}-${index + 1}`,
              received_by: profile?.full_name || 'Accounts Team',
              notes: notes.trim() || null,
              items: validItems,
              deposit_account: deposit,
            } as Json,
          };
        });
        await paymentService.insertReceipts(rows);
        Alert.alert('Bulk receipts', `${rows.length} receipts created.`);
      }
      setSelected(new Set());
      await loadArchive();
    } catch (e: any) {
      Alert.alert('Bulk payments', e?.message ?? 'Operation failed.');
    } finally {
      setRunning(false);
    }
  };

  if (!isAdmin && !isSchool) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Bulk payments" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.muted}>This screen is for admin and school accounts.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Bulk payments" subtitle="Invoices & receipts by batch" onBack={() => navigation.goBack()} />

      <View style={styles.tabRow}>
        {(['generate', 'archive'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            style={[styles.tabBtn, tab === k && { borderColor: colors.primary, backgroundColor: colors.primaryPale }]}
          >
            <Text style={[styles.tabBtnText, tab === k && { color: colors.primary }]}>
              {k === 'generate' ? 'Generate' : 'Archive'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : tab === 'archive' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bulk-tagged invoices</Text>
          {archiveInvoices.length === 0 ? (
            <Text style={[styles.muted, { marginBottom: SPACING.lg }]}>No invoices with BULK- notes yet.</Text>
          ) : (
            archiveInvoices.slice(0, 40).map((inv: any) => (
              <View key={inv.invoice_number} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{inv.invoice_number}</Text>
                <Text style={[styles.muted, { marginTop: 4 }]}>
                  {(inv.portal_users as any)?.full_name ?? '—'} · {inv.status} · ₦{Number(inv.amount).toLocaleString()}
                </Text>
                <Text style={[styles.muted, { marginTop: 4, fontSize: FONT_SIZE.xs }]} numberOfLines={2}>
                  {inv.notes}
                </Text>
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: SPACING.lg }]}>Receipt batches (metadata)</Text>
          {archiveReceipts.length === 0 ? (
            <Text style={styles.muted}>No receipt metadata batches in the recent window.</Text>
          ) : (
            archiveReceipts.map((b: any) => (
              <View key={b.batch_id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{b.batch_id}</Text>
                <Text style={styles.muted}>{b.count} receipt(s)</Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {isAdmin ? (
            <View style={{ marginBottom: SPACING.md }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>School</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {schoolOptions.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSchoolId(s.id)}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.bgCard },
                      schoolId === s.id && { borderColor: colors.primary, backgroundColor: colors.primaryPale },
                    ]}
                  >
                    <Text style={[styles.chipText, schoolId === s.id && { color: colors.primary }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.textMuted }]}>Document</Text>
          <View style={styles.chipRow}>
            {(['invoice', 'receipt'] as DocKind[]).map((k) => (
              <TouchableOpacity
                key={k}
                onPress={() => setDocKind(k)}
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: colors.bgCard },
                  docKind === k && { borderColor: colors.primary, backgroundColor: colors.primaryPale },
                ]}
              >
                <Text style={[styles.chipText, docKind === k && { color: colors.primary }]}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.md }]}>Recipient list</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              onPress={() => setAudience('portal')}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: colors.bgCard },
                audience === 'portal' && { borderColor: colors.primary, backgroundColor: colors.primaryPale },
              ]}
            >
              <Text style={[styles.chipText, audience === 'portal' && { color: colors.primary }]}>Portal students</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setAudience('registration');
                setDocKind('receipt');
              }}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: colors.bgCard },
                audience === 'registration' && { borderColor: colors.primary, backgroundColor: colors.primaryPale },
              ]}
            >
              <Text style={[styles.chipText, audience === 'registration' && { color: colors.primary }]}>Registration</Text>
            </TouchableOpacity>
          </View>
          {docKind === 'invoice' && audience === 'registration' ? (
            <Text style={[styles.warn, { color: colors.warning }]}>Invoices are limited to portal students (billing accounts).</Text>
          ) : null}

          <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <TextInput
              value={pickQuery}
              onChangeText={setPickQuery}
              placeholder="Search…"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.textPrimary }]}
            />
          </View>
          <View style={styles.rowBtns}>
            <TouchableOpacity onPress={selectAllFiltered} style={[styles.smallBtn, { borderColor: colors.primary }]}>
              <Text style={[styles.smallBtnText, { color: colors.primary }]}>Select filtered</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearSelection} style={[styles.smallBtn, { borderColor: colors.border }]}>
              <Text style={[styles.smallBtnText, { color: colors.textMuted }]}>Clear</Text>
            </TouchableOpacity>
            <Text style={[styles.muted, { marginLeft: 'auto' }]}>{selected.size} selected</Text>
          </View>

          <View style={{ maxHeight: 220, marginBottom: SPACING.md }}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              {filteredPick.map((r: any) => {
                const id = r.id;
                const label = audience === 'portal' ? r.full_name : r.display_name;
                const sub = audience === 'portal' ? r.email : r.email || r.parent_email || '';
                const on = selected.has(id);
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => toggle(id)}
                    style={[
                      styles.pickRow,
                      { borderColor: colors.border, backgroundColor: colors.bgCard },
                      on && { borderColor: colors.primary, backgroundColor: colors.primaryPale },
                    ]}
                  >
                    <Text style={[styles.pickTitle, { color: colors.textPrimary }]}>{label}</Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Line items</Text>
          {items.map((it, index) => (
            <View key={index} style={[styles.itemBlock, { borderColor: colors.border }]}>
              <TextInput
                value={it.description}
                onChangeText={(t) => updateItem(index, { description: t })}
                placeholder="Description"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
              />
              <View style={styles.itemNums}>
                <TextInput
                  value={String(it.quantity)}
                  onChangeText={(t) => updateItem(index, { quantity: Number(t) || 1 })}
                  keyboardType="numeric"
                  style={[styles.inputSm, { color: colors.textPrimary, borderColor: colors.border }]}
                />
                <TextInput
                  value={String(it.unit_price)}
                  onChangeText={(t) => updateItem(index, { unit_price: Number(t) || 0 })}
                  keyboardType="numeric"
                  style={[styles.inputSm, { color: colors.textPrimary, borderColor: colors.border }]}
                />
                <Text style={[styles.muted, { alignSelf: 'center' }]}>₦{it.total.toLocaleString()}</Text>
              </View>
              {items.length > 1 ? (
                <TouchableOpacity onPress={() => removeItem(index)}>
                  <Text style={{ color: colors.error, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs }}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          <TouchableOpacity onPress={addItem} style={{ marginBottom: SPACING.md }}>
            <Text style={{ color: colors.primary, fontFamily: FONT_FAMILY.bodySemi }}>+ Add line</Text>
          </TouchableOpacity>

          {docKind === 'invoice' ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Due date (optional)</Text>
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, marginBottom: SPACING.sm }]}
              />
              <View style={styles.chipRow}>
                {(['sent', 'draft'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setInvoiceStatus(s)}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.bgCard },
                      invoiceStatus === s && { borderColor: colors.primary, backgroundColor: colors.primaryPale },
                    ]}
                  >
                    <Text style={[styles.chipText, invoiceStatus === s && { color: colors.primary }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Payment method</Text>
              <TextInput
                value={paymentMethod}
                onChangeText={setPaymentMethod}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, marginBottom: SPACING.sm }]}
              />
              <Text style={[styles.label, { color: colors.textMuted }]}>Payment date</Text>
              <TextInput
                value={paymentDate}
                onChangeText={setPaymentDate}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, marginBottom: SPACING.sm }]}
              />
              <Text style={[styles.label, { color: colors.textMuted }]}>Reference prefix (optional)</Text>
              <TextInput
                value={referencePrefix}
                onChangeText={setReferencePrefix}
                placeholder="e.g. TERM2"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, marginBottom: SPACING.sm }]}
              />
            </>
          )}

          {accounts.length > 0 ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Deposit account hint</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {accounts.map((a, i) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => setAccountIndex(i)}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.bgCard },
                      accountIndex === i && { borderColor: colors.primary, backgroundColor: colors.primaryPale },
                    ]}
                  >
                    <Text style={[styles.chipText, accountIndex === i && { color: colors.primary }]} numberOfLines={1}>
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.textMuted }]}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, minHeight: 64, marginBottom: SPACING.lg }]}
          />

          <TouchableOpacity
            disabled={running}
            onPress={() => void runBulk()}
            style={[styles.runBtn, { backgroundColor: colors.primary, opacity: running ? 0.6 : 1 }]}
          >
            <Text style={styles.runBtnText}>{running ? 'Working…' : docKind === 'invoice' ? 'Create bulk invoices' : 'Create bulk receipts'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function getStyles(colors: { bg: string; textPrimary: string; textMuted: string }) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.xl, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['2xl'] },
    muted: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textMuted },
    tabRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm },
    tabBtn: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.textMuted + '40',
    },
    tabBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, letterSpacing: LETTER_SPACING.wide, color: colors.textMuted },
    sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, marginBottom: SPACING.sm },
    label: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, letterSpacing: LETTER_SPACING.wide, marginBottom: 6, textTransform: 'uppercase' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
    chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1 },
    chipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: colors.textMuted, maxWidth: 200 },
    searchWrap: { borderWidth: 1, borderRadius: RADIUS.md, marginBottom: SPACING.sm },
    searchInput: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontFamily: FONT_FAMILY.body },
    rowBtns: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
    smallBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1 },
    smallBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
    pickRow: { padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, marginBottom: 6 },
    pickTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
    itemBlock: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, gap: SPACING.sm, marginBottom: SPACING.sm },
    input: {
      borderWidth: 1,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.sm,
      fontFamily: FONT_FAMILY.body,
    },
    inputSm: {
      flex: 1,
      borderWidth: 1,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.sm,
      fontFamily: FONT_FAMILY.body,
    },
    itemNums: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
    runBtn: { paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center' },
    runBtnText: { fontFamily: FONT_FAMILY.bodySemi, color: '#fff', fontSize: FONT_SIZE.sm, letterSpacing: LETTER_SPACING.wide },
    card: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
    cardTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
    warn: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginBottom: SPACING.sm },
  });
}
