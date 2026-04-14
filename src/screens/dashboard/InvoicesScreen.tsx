import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, ScrollView, TextInput, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { paymentService, finalizeInvoiceLineDrafts, type InvoiceInsert } from '../../services/payment.service';
import { studentService } from '../../services/student.service';
import { schoolService } from '../../services/school.service';
import { invoicePDFService } from '../../services/invoicePDF.service';
import type { Json } from '../../types/supabase';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useHaptics } from '../../hooks/useHaptics';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string | null;
  created_at: string | null;
  notes: string | null;
  school_id: string | null;
  portal_user_id: string | null;
  payment_link: string | null;
  payment_transaction_id: string | null;
  items: InvoiceItem[];
  schools: { name: string | null } | null;
  portal_users: { full_name: string | null; email?: string | null } | null;
}

interface PaymentAccount {
  id: string;
  label: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  account_type: string;
  owner_type: string;
  payment_note: string | null;
  school_id: string | null;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function parseInvoiceItems(value: unknown): InvoiceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      description: typeof item?.description === 'string' ? item.description : 'Payment',
      quantity: typeof item?.quantity === 'number' ? item.quantity : Number(item?.quantity ?? 1) || 1,
      unit_price: typeof item?.unit_price === 'number' ? item.unit_price : Number(item?.unit_price ?? 0) || 0,
      total: typeof item?.total === 'number'
        ? item.total
        : (Number(item?.quantity ?? 1) || 1) * (Number(item?.unit_price ?? 0) || 0),
    }))
    .filter((item) => item.description || item.total > 0);
}

export default function InvoicesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { light } = useHaptics();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [students, setStudents] = useState<{ id: string; full_name: string; email: string; school_id: string | null }[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [createForm, setCreateForm] = useState({
    student_id: '',
    due_date: '',
    notes: '',
    status: 'sent' as InvoiceStatus,
    items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
  });
  const [bulkForm, setBulkForm] = useState({
    school_id: '',
    due_date: '',
    notes: '',
    status: 'sent' as InvoiceStatus,
    items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
  });
  const [editDue, setEditDue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<InvoiceStatus>('sent');
  const [editItems, setEditItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
  const [savingInvoiceEdit, setSavingInvoiceEdit] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isSchool = profile?.role === 'school';

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      if (isAdmin || isSchool) {
        await paymentService.autoMarkOverdueInvoices({
          role: profile.role,
          schoolId: profile.school_id,
        });
      }

      const [invoiceData, accountData] = await Promise.all([
        paymentService.listInvoices({
          role: profile.role,
          userId: profile.id,
          schoolId: profile.school_id
        }),
        paymentService.listPaymentAccounts({
          isAdmin,
          schoolId: profile.school_id
        })
      ]);

      if (isAdmin || isSchool) {
        const [studentData, schoolData] = await Promise.all([
          studentService.listActiveStudentsForBilling({
            schoolId: isSchool && profile.school_id ? profile.school_id : undefined,
          }),
          isAdmin
            ? schoolService.listApprovedSchoolOptions()
            : profile.school_id
              ? schoolService.getSchoolOptionRow(profile.school_id)
              : Promise.resolve([]),
        ]);
        setStudents(studentData as { id: string; full_name: string; email: string; school_id: string | null }[]);
        setSchools(schoolData as { id: string; name: string }[]);
      } else {
        setStudents([]);
        setSchools([]);
      }

      setInvoices(
        ((invoiceData ?? []) as any[]).map((invoice) => ({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: invoice.amount ?? 0,
          currency: invoice.currency ?? 'NGN',
          status: (invoice.status ?? 'sent') as InvoiceStatus,
          due_date: invoice.due_date ?? null,
          created_at: invoice.created_at ?? null,
          notes: invoice.notes ?? null,
          school_id: invoice.school_id ?? null,
          portal_user_id: invoice.portal_user_id ?? null,
          payment_link: invoice.payment_link ?? null,
          payment_transaction_id: invoice.payment_transaction_id ?? null,
          items: parseInvoiceItems(invoice.items),
          schools: invoice.schools ?? null,
          portal_users: invoice.portal_users ?? null,
        }))
      );

      setPaymentAccounts((accountData ?? []) as PaymentAccount[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, isSchool, profile]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedInvoice) return;
    setEditDue(selectedInvoice.due_date ? String(selectedInvoice.due_date).split('T')[0] : '');
    setEditNotes(selectedInvoice.notes ?? '');
    setEditStatus(selectedInvoice.status);
    const base =
      selectedInvoice.items.length > 0
        ? selectedInvoice.items.map((i) => ({ ...i }))
        : [{ description: '', quantity: 1, unit_price: 0, total: 0 }];
    setEditItems(base);
  }, [selectedInvoice]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const target = invoice.portal_users?.full_name || invoice.schools?.name || '';
      const firstItem = invoice.items[0]?.description ?? '';
      const matchesSearch =
        !query ||
        invoice.invoice_number.toLowerCase().includes(query) ||
        target.toLowerCase().includes(query) ||
        firstItem.toLowerCase().includes(query);
      const matchesStatus = filter === 'all' || invoice.status === filter;
      return matchesSearch && matchesStatus;
    });
  }, [filter, invoices, search]);

  const stats = useMemo(() => {
    const outstanding = invoices.filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue');
    return {
      outstandingAmount: outstanding.reduce((sum, invoice) => sum + invoice.amount, 0),
      outstandingCount: outstanding.length,
      paidCount: invoices.filter((invoice) => invoice.status === 'paid').length,
      overdueCount: invoices.filter((invoice) => invoice.status === 'overdue').length,
      currency: invoices[0]?.currency ?? 'NGN',
    };
  }, [invoices]);

  const filters: { key: 'all' | InvoiceStatus; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'sent', label: 'SENT' },
    { key: 'paid', label: 'PAID' },
    { key: 'overdue', label: 'OVERDUE' },
    { key: 'draft', label: 'DRAFT' },
  ];

  const getStatusColor = (status: InvoiceStatus) => {
    if (status === 'paid') return colors.success;
    if (status === 'overdue') return colors.error;
    if (status === 'cancelled') return colors.textMuted;
    if (status === 'draft') return colors.warning;
    return colors.primary;
  };

  const openInvoice = (invoice: Invoice) => {
    light();
    setSelectedInvoice(invoice);
  };

  const updateCreateItem = (index: number, patch: Partial<InvoiceItem>) => {
    setCreateForm((current) => {
      const items = [...current.items];
      const next = { ...items[index], ...patch };
      next.total = Number(next.quantity || 0) * Number(next.unit_price || 0);
      items[index] = next;
      return { ...current, items };
    });
  };

  const addCreateItem = () => {
    setCreateForm((current) => ({
      ...current,
      items: [...current.items, { description: '', quantity: 1, unit_price: 0, total: 0 }],
    }));
  };

  const removeCreateItem = (index: number) => {
    setCreateForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateEditItem = (index: number, patch: Partial<InvoiceItem>) => {
    setEditItems((current) => {
      const items = [...current];
      const next = { ...items[index], ...patch };
      next.total = Number(next.quantity || 0) * Number(next.unit_price || 0);
      items[index] = next;
      return items;
    });
  };

  const addEditItem = () => {
    setEditItems((current) => [...current, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeEditItem = (index: number) => {
    setEditItems((current) =>
      current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const updateBulkItem = (index: number, patch: Partial<InvoiceItem>) => {
    setBulkForm((current) => {
      const items = [...current.items];
      const next = { ...items[index], ...patch };
      next.total = Number(next.quantity || 0) * Number(next.unit_price || 0);
      items[index] = next;
      return { ...current, items };
    });
  };

  const addBulkItem = () => {
    setBulkForm((current) => ({
      ...current,
      items: [...current.items, { description: '', quantity: 1, unit_price: 0, total: 0 }],
    }));
  };

  const removeBulkItem = (index: number) => {
    setBulkForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const createInvoice = async () => {
    const validItems = createForm.items.filter((item) => item.description.trim() && item.unit_price > 0);
    if (!createForm.student_id || validItems.length === 0) {
      Alert.alert('Invoice builder', 'Choose a student and add at least one valid line item.');
      return;
    }

    const selectedStudent = students.find((student) => student.id === createForm.student_id);
    const totalAmount = validItems.reduce((sum, item) => sum + item.total, 0);
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

    setSavingInvoice(true);
    try {
      const invoicePayload: InvoiceInsert = {
        invoice_number: invoiceNumber,
        portal_user_id: createForm.student_id,
        school_id: selectedStudent?.school_id ?? profile?.school_id ?? null,
        amount: totalAmount,
        currency: 'NGN',
        status: createForm.status,
        due_date: createForm.due_date || null,
        notes: createForm.notes.trim() || null,
        items: validItems as unknown as Json,
      };
      await paymentService.createInvoice(invoicePayload);

      setShowCreate(false);
      setCreateForm({
        student_id: '',
        due_date: '',
        notes: '',
        status: 'sent',
        items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
      });
      await load();
    } catch (error: any) {
      Alert.alert('Invoice builder', error?.message ?? 'Could not create invoice.');
    } finally {
      setSavingInvoice(false);
    }
  };

  const createBulkInvoices = async () => {
    const validItems = bulkForm.items.filter((item) => item.description.trim() && item.unit_price > 0);
    const targetSchoolId = isSchool ? profile?.school_id ?? '' : bulkForm.school_id;
    if (!targetSchoolId || validItems.length === 0) {
      Alert.alert('Bulk billing', 'Choose a school and add at least one valid line item.');
      return;
    }

    const recipients = students.filter((student) => student.school_id === targetSchoolId);
    if (!recipients.length) {
      Alert.alert('Bulk billing', 'No active students were found for that school.');
      return;
    }

    setSavingInvoice(true);
    try {
      const totalAmount = validItems.reduce((sum, item) => sum + item.total, 0);
      const rows: InvoiceInsert[] = recipients.map((student, index) => ({
        invoice_number: `INV-${Date.now().toString(36).toUpperCase()}-${index + 1}`,
        portal_user_id: student.id,
        school_id: targetSchoolId,
        amount: totalAmount,
        currency: 'NGN',
        status: bulkForm.status,
        due_date: bulkForm.due_date || null,
        notes: bulkForm.notes.trim() || null,
        items: validItems as unknown as Json,
      }));

      await paymentService.createBulkInvoices(rows);

      setShowBulkCreate(false);
      setBulkForm({
        school_id: isSchool ? profile?.school_id ?? '' : '',
        due_date: '',
        notes: '',
        status: 'sent',
        items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
      });
      Alert.alert('Bulk billing', `${rows.length} invoices issued successfully.`);
      await load();
    } catch (error: any) {
      Alert.alert('Bulk billing', error?.message ?? 'Could not issue bulk invoices.');
    } finally {
      setSavingInvoice(false);
    }
  };

  const updateInvoiceStatus = async (invoice: Invoice, status: InvoiceStatus) => {
    try {
      await paymentService.updateInvoiceStatus(invoice.id, status);
      await load();
      setSelectedInvoice((current) => (current?.id === invoice.id ? { ...current, status } : current));
    } catch (error: any) {
      Alert.alert('Invoice', error.message);
    }
  };

  const saveInvoiceDetails = async () => {
    if (!selectedInvoice || (!isAdmin && !isSchool)) return;
    if (selectedInvoice.status === 'paid' || selectedInvoice.status === 'cancelled') {
      Alert.alert('Invoice', 'Paid or cancelled invoices cannot be edited here.');
      return;
    }
    const finalized = finalizeInvoiceLineDrafts(editItems);
    if (!finalized) {
      Alert.alert('Invoice', 'Add at least one line item with description and amount.');
      return;
    }
    setSavingInvoiceEdit(true);
    try {
      await paymentService.patchInvoice(selectedInvoice.id, {
        due_date: editDue.trim() || null,
        notes: editNotes.trim() || null,
        status: editStatus,
        items: finalized.items,
        amount: finalized.amount,
        updated_at: new Date().toISOString(),
      });
      await load();
      const nextItems = parseInvoiceItems(finalized.items);
      setSelectedInvoice((prev) =>
        prev && prev.id === selectedInvoice.id
          ? {
              ...prev,
              due_date: editDue.trim() || null,
              notes: editNotes.trim() || null,
              status: editStatus,
              items: nextItems,
              amount: finalized.amount,
            }
          : prev,
      );
      setEditItems(nextItems.length ? nextItems.map((i) => ({ ...i })) : [{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
      Alert.alert('Invoice', 'Details and line items saved.');
    } catch (error: any) {
      Alert.alert('Invoice', error?.message ?? 'Could not save.');
    } finally {
      setSavingInvoiceEdit(false);
    }
  };

  const markInvoicePaid = async (invoice: Invoice) => {
    Alert.alert('Mark Invoice Paid', `Confirm ${invoice.invoice_number} as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await paymentService.markAsPaid(invoice.id);
            await load();
            setSelectedInvoice((current) => (current?.id === invoice.id ? { ...invoice, status: 'paid' } : current));
          } catch (error: any) {
            Alert.alert('Invoice', error.message);
          }
        },
      },
    ]);
  };

  const printInvoice = async (invoice: Invoice) => {
    setExporting(true);
    try {
      await invoicePDFService.generateAndShare({
        number: invoice.invoice_number,
        date: invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
        items: invoice.items,
        amount: invoice.amount,
        currency: invoice.currency,
        studentName: invoice.portal_users?.full_name || 'Student',
        schoolName: invoice.schools?.name || 'Rillcod Academy',
        status: invoice.status,
        notes: invoice.notes || undefined,
      }, 'classic');
    } catch (error: any) {
      Alert.alert('Print Failed', error?.message ?? 'Could not generate professional PDF.');
    } finally {
      setExporting(false);
    }
  };

  const openPayment = async (invoice: Invoice) => {
    if (invoice.payment_link) {
      const supported = await Linking.canOpenURL(invoice.payment_link);
      if (supported) {
        await Linking.openURL(invoice.payment_link);
        return;
      }
    }
    const instructions = paymentAccounts.length > 0
      ? paymentAccounts
          .map((account) => `${account.label}\n${account.bank_name} · ${account.account_number}\n${account.account_name}${account.payment_note ? `\n${account.payment_note}` : ''}`)
          .join('\n\n')
      : 'No payment link is attached yet. Please contact the accounts team for payment instructions.';
    Alert.alert('Payment Instructions', instructions);
  };

  const renderItem = ({ item, index }: { item: Invoice; index: number }) => {
    const statusColor = getStatusColor(item.status);
    const targetName = item.portal_users?.full_name || item.schools?.name || 'Billing Record';
    const previewTitle = item.items[0]?.description || item.notes || 'Invoice';

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 35 }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => openInvoice(item)}
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.targetBadge, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.targetIcon, { color: colors.primary }]}>{item.school_id ? 'SC' : 'ST'}</Text>
              <Text style={[styles.targetText, { color: colors.textSecondary }]} numberOfLines={1}>
                {targetName.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor + '15', borderColor: statusColor + '35' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.invTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {previewTitle}
              </Text>
              <Text style={[styles.invNumber, { color: colors.textMuted }]}>{item.invoice_number}</Text>
            </View>
            <Text style={[styles.amount, { color: colors.textPrimary }]}>{formatMoney(item.amount, item.currency)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>DATE: {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : 'N/A'}</Text>
            {item.due_date ? (
              <Text style={[styles.meta, { color: item.status === 'overdue' ? colors.error : colors.textMuted }]}>DUE: {new Date(item.due_date).toLocaleDateString('en-GB')}</Text>
            ) : null}
            <Text style={[styles.meta, { color: colors.textMuted }]}>ITEMS: {item.items.length}</Text>
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={isAdmin ? 'FINANCE CENTRE' : 'MY INVOICES'} onBack={() => navigation.goBack()} />

      {(isAdmin || isSchool) && (
        <View style={styles.createRowGroup}>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setShowCreate(true)}>
            <Text style={styles.createBtnText}>+ ISSUE INVOICE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.bgCard, borderColor: colors.primary }]} onPress={() => setShowBulkCreate(true)}>
            <Text style={[styles.createBtnText, { color: colors.primary }]}>BULK INVOICES</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.warning }]}>OUTSTANDING</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatMoney(stats.outstandingAmount, stats.currency)}</Text>
          <Text style={[styles.statMeta, { color: colors.textMuted }]}>{stats.outstandingCount} open invoices</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.success }]}>SETTLED</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.paidCount}</Text>
          <Text style={[styles.statMeta, { color: colors.textMuted }]}>fully paid</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.error }]}>OVERDUE</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.overdueCount}</Text>
          <Text style={[styles.statMeta, { color: colors.textMuted }]}>needs action</Text>
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={styles.searchIcon}>S</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search invoice number or recipient..."
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.textPrimary }]}
        />
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((entry) => (
            <TouchableOpacity
              key={entry.key}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: colors.bgCard },
                filter === entry.key && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
              ]}
              onPress={() => {
                setFilter(entry.key);
                light();
              }}
            >
              <Text style={[styles.chipText, { color: filter === entry.key ? colors.primary : colors.textMuted }]}>
                {entry.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>0</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No invoices found</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selectedInvoice} animationType="slide" transparent onRequestClose={() => setSelectedInvoice(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            {selectedInvoice ? (
              <>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalEyebrow, { color: colors.primary }]}>INVOICE VIEW</Text>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{selectedInvoice.invoice_number}</Text>
                    <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                      {selectedInvoice.portal_users?.full_name || selectedInvoice.schools?.name || 'Billing Record'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedInvoice(null)} style={[styles.closeBtn, { borderColor: colors.border }]}> 
                    <Text style={[styles.closeText, { color: colors.textSecondary }]}>X</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.modalScroll}>
                  <View style={[styles.detailHero, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                    <Text style={[styles.detailStatus, { color: getStatusColor(selectedInvoice.status) }]}>
                      {selectedInvoice.status.toUpperCase()}
                    </Text>
                    <Text style={[styles.detailAmount, { color: colors.textPrimary }]}>
                      {formatMoney(selectedInvoice.amount, selectedInvoice.currency)}
                    </Text>
                    <Text style={[styles.detailMeta, { color: colors.textMuted }]}> 
                      CREATED {selectedInvoice.created_at ? new Date(selectedInvoice.created_at).toLocaleDateString('en-GB') : 'N/A'}
                    </Text>
                    {selectedInvoice.due_date ? (
                      <Text style={[styles.detailMeta, { color: selectedInvoice.status === 'overdue' ? colors.error : colors.textMuted }]}> 
                        DUE {new Date(selectedInvoice.due_date).toLocaleDateString('en-GB')}
                      </Text>
                    ) : null}
                  </View>

                  <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>LINE ITEMS</Text>
                    {selectedInvoice.items.length === 0 ? (
                      <Text style={[styles.sectionBody, { color: colors.textMuted }]}>No line items recorded.</Text>
                    ) : (
                      selectedInvoice.items.map((item, index) => (
                        <View key={`${selectedInvoice.id}-${index}`} style={[styles.lineItem, { borderBottomColor: colors.border }]}> 
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.lineTitle, { color: colors.textPrimary }]}>{item.description}</Text>
                            <Text style={[styles.lineMeta, { color: colors.textMuted }]}> 
                              {item.quantity} x {formatMoney(item.unit_price, selectedInvoice.currency)}
                            </Text>
                          </View>
                          <Text style={[styles.lineTotal, { color: colors.textPrimary }]}>
                            {formatMoney(item.total, selectedInvoice.currency)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>

                  {selectedInvoice.notes && (!isAdmin && !isSchool) ? (
                    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>NOTES</Text>
                      <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{selectedInvoice.notes}</Text>
                    </View>
                  ) : null}

                  {(isAdmin || isSchool) && selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' ? (
                    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>EDIT (WEB PARITY)</Text>
                      <Text style={[styles.formLabel, { color: colors.textMuted }]}>DUE DATE</Text>
                      <TextInput
                        value={editDue}
                        onChangeText={setEditDue}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                      />
                      <Text style={[styles.formLabel, { color: colors.textMuted }]}>NOTES</Text>
                      <TextInput
                        value={editNotes}
                        onChangeText={setEditNotes}
                        multiline
                        placeholder="Internal notes"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.formInput, styles.formArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                      />
                      <Text style={[styles.formLabel, { color: colors.textMuted }]}>STATUS</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {(['draft', 'sent', 'overdue'] as InvoiceStatus[]).map((s) => {
                          const active = editStatus === s;
                          return (
                            <TouchableOpacity
                              key={s}
                              onPress={() => setEditStatus(s)}
                              style={[
                                styles.chip,
                                { borderColor: colors.border, backgroundColor: colors.bg },
                                active && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                              ]}
                            >
                              <Text style={[styles.chipText, { color: active ? colors.primary : colors.textMuted }]}>{s}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      <TouchableOpacity
                        onPress={() => void saveInvoiceDetails()}
                        disabled={savingInvoiceEdit}
                        style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary, marginTop: 12 }]}
                      >
                        <Text style={styles.actionPrimaryText}>{savingInvoiceEdit ? 'SAVING…' : 'SAVE CHANGES'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {paymentAccounts.length > 0 ? (
                    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PAYMENT ACCOUNTS</Text>
                      {paymentAccounts.map((account) => (
                        <View key={account.id} style={[styles.accountCard, { borderColor: colors.border }]}> 
                          <Text style={[styles.lineTitle, { color: colors.textPrimary }]}>{account.label}</Text>
                          <Text style={[styles.sectionBody, { color: colors.textMuted }]}>
                            {account.bank_name} · {account.account_number}
                          </Text>
                          <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{account.account_name}</Text>
                          {account.payment_note ? (
                            <Text style={[styles.accountNote, { color: colors.textMuted }]}>{account.payment_note}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>

                <View style={[styles.actionBar, { borderTopColor: colors.border, flexWrap: 'wrap' }]}> 
                  {(isAdmin || isSchool) && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => {
                        const data = selectedInvoice;
                        setSelectedInvoice(null);
                        navigation.navigate(ROUTES.InvoiceEditor, {
                          invoiceData: {
                            ...data,
                            number: data.invoice_number,
                            invoice_number: data.invoice_number,
                            studentName: data.portal_users?.full_name || 'Student',
                            schoolName: data.schools?.name || 'Rillcod Academy',
                          }
                        });
                      }}
                    >
                      <Text style={styles.actionPrimaryText}>✦ SMART EDIT</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => printInvoice(selectedInvoice)}
                    disabled={exporting}
                  >
                    <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                      {exporting ? 'EXPORTING...' : 'PRINT PDF'}
                    </Text>
                  </TouchableOpacity>

                  {!isAdmin && selectedInvoice.status !== 'paid' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => openPayment(selectedInvoice)}
                    >
                      <Text style={styles.actionPrimaryText}>
                        {selectedInvoice.payment_link ? 'OPEN PAYMENT' : 'PAYMENT INFO'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {isAdmin && selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.success, borderColor: colors.success }]}
                      onPress={() => markInvoicePaid(selectedInvoice)}
                    >
                      <Text style={styles.actionPrimaryText}>MARK PAID</Text>
                    </TouchableOpacity>
                  ) : null}

                  {(isAdmin || isSchool) && selectedInvoice.status === 'draft' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => updateInvoiceStatus(selectedInvoice, 'sent')}
                    >
                      <Text style={styles.actionPrimaryText}>SEND</Text>
                    </TouchableOpacity>
                  ) : null}

                  {(isAdmin || isSchool) && selectedInvoice.status !== 'cancelled' && selectedInvoice.status !== 'paid' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.error }]}
                      onPress={() => updateInvoiceStatus(selectedInvoice, 'cancelled')}
                    >
                      <Text style={[styles.actionText, { color: colors.error }]}>CANCEL</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalEyebrow, { color: colors.primary }]}>INVOICE BUILDER</Text>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create invoice</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>Issue a student invoice directly from mobile.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={[styles.closeBtn, { borderColor: colors.border }]}>
                <Text style={[styles.closeText, { color: colors.textSecondary }]}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>RECIPIENT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {students.map((student) => {
                    const active = createForm.student_id === student.id;
                    return (
                      <TouchableOpacity
                        key={student.id}
                        onPress={() => setCreateForm((current) => ({ ...current, student_id: student.id }))}
                        style={[
                          styles.chip,
                          { borderColor: colors.border, backgroundColor: colors.bg },
                          active && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: active ? colors.primary : colors.textMuted }]}>{student.full_name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.formLabel, { color: colors.textMuted }]}>DUE DATE</Text>
                <TextInput
                  value={createForm.due_date}
                  onChangeText={(value) => setCreateForm((current) => ({ ...current, due_date: value }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                />

                <Text style={[styles.formLabel, { color: colors.textMuted }]}>STATUS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {(['draft', 'sent'] as InvoiceStatus[]).map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setCreateForm((current) => ({ ...current, status }))}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.bg },
                        createForm.status === status && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: createForm.status === status ? colors.primary : colors.textMuted }]}>{status.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <View style={styles.lineBuilderHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>LINE ITEMS</Text>
                  <TouchableOpacity onPress={addCreateItem}>
                    <Text style={[styles.addLineText, { color: colors.primary }]}>+ Add line</Text>
                  </TouchableOpacity>
                </View>

                {createForm.items.map((item, index) => (
                  <View key={`create-item-${index}`} style={[styles.builderCard, { borderColor: colors.border }]}>
                    <TextInput
                      value={item.description}
                      onChangeText={(value) => updateCreateItem(index, { description: value })}
                      placeholder="Description"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                    />
                    <View style={styles.builderRow}>
                      <TextInput
                        value={String(item.quantity)}
                        onChangeText={(value) => updateCreateItem(index, { quantity: Number(value || 0) })}
                        placeholder="Qty"
                        keyboardType="number-pad"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.formInput, styles.builderHalf, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                      />
                      <TextInput
                        value={String(item.unit_price)}
                        onChangeText={(value) => updateCreateItem(index, { unit_price: Number(value || 0) })}
                        placeholder="Unit price"
                        keyboardType="number-pad"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.formInput, styles.builderHalf, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                      />
                    </View>
                    <View style={styles.builderFooter}>
                      <Text style={[styles.lineTotalLabel, { color: colors.textMuted }]}>TOTAL</Text>
                      <Text style={[styles.lineTotalValue, { color: colors.textPrimary }]}>{formatMoney(item.total, 'NGN')}</Text>
                    </View>
                    {createForm.items.length > 1 ? (
                      <TouchableOpacity onPress={() => removeCreateItem(index)}>
                        <Text style={[styles.removeLineText, { color: colors.error }]}>Remove line</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                <Text style={[styles.invoiceTotal, { color: colors.textPrimary }]}>
                  TOTAL {formatMoney(createForm.items.reduce((sum, item) => sum + item.total, 0), 'NGN')}
                </Text>
              </View>

              <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>NOTES</Text>
                <TextInput
                  value={createForm.notes}
                  onChangeText={(value) => setCreateForm((current) => ({ ...current, notes: value }))}
                  placeholder="Optional invoice note"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={[styles.formInput, styles.formArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                />
              </View>
            </ScrollView>

            <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => setShowCreate(false)}>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>CLOSE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={createInvoice} disabled={savingInvoice}>
                <Text style={styles.actionPrimaryText}>{savingInvoice ? 'ISSUING...' : 'ISSUE INVOICE'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBulkCreate} animationType="slide" transparent onRequestClose={() => setShowBulkCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalEyebrow, { color: colors.primary }]}>BULK BILLING</Text>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Issue invoices in bulk</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>Create matching invoices for every active student in a school.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBulkCreate(false)} style={[styles.closeBtn, { borderColor: colors.border }]}>
                <Text style={[styles.closeText, { color: colors.textSecondary }]}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>SCHOOL</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {(isSchool ? schools.filter((school) => school.id === profile?.school_id) : schools).map((school) => (
                    <TouchableOpacity
                      key={school.id}
                      onPress={() => setBulkForm((current) => ({ ...current, school_id: school.id }))}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.bg },
                        bulkForm.school_id === school.id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: bulkForm.school_id === school.id ? colors.primary : colors.textMuted }]}>{school.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {bulkForm.school_id ? (
                  <Text style={[styles.sectionBody, { color: colors.textMuted }]}>
                    {students.filter((student) => student.school_id === bulkForm.school_id).length} active students will be billed.
                  </Text>
                ) : null}

                <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: SPACING.md }]}>DUE DATE</Text>
                <TextInput
                  value={bulkForm.due_date}
                  onChangeText={(value) => setBulkForm((current) => ({ ...current, due_date: value }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                />

                <Text style={[styles.formLabel, { color: colors.textMuted }]}>STATUS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {(['draft', 'sent'] as InvoiceStatus[]).map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setBulkForm((current) => ({ ...current, status }))}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.bg },
                        bulkForm.status === status && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: bulkForm.status === status ? colors.primary : colors.textMuted }]}>{status.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <View style={styles.lineBuilderHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>LINE ITEMS</Text>
                  <TouchableOpacity onPress={addBulkItem}>
                    <Text style={[styles.addLineText, { color: colors.primary }]}>+ Add line</Text>
                  </TouchableOpacity>
                </View>

                {bulkForm.items.map((item, index) => (
                  <View key={`bulk-item-${index}`} style={[styles.builderCard, { borderColor: colors.border }]}>
                    <TextInput
                      value={item.description}
                      onChangeText={(value) => updateBulkItem(index, { description: value })}
                      placeholder="Description"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                    />
                    <View style={styles.builderRow}>
                      <TextInput
                        value={String(item.quantity)}
                        onChangeText={(value) => updateBulkItem(index, { quantity: Number(value || 0) })}
                        placeholder="Qty"
                        keyboardType="number-pad"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.formInput, styles.builderHalf, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                      />
                      <TextInput
                        value={String(item.unit_price)}
                        onChangeText={(value) => updateBulkItem(index, { unit_price: Number(value || 0) })}
                        placeholder="Unit price"
                        keyboardType="number-pad"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.formInput, styles.builderHalf, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                      />
                    </View>
                    <View style={styles.builderFooter}>
                      <Text style={[styles.lineTotalLabel, { color: colors.textMuted }]}>TOTAL</Text>
                      <Text style={[styles.lineTotalValue, { color: colors.textPrimary }]}>{formatMoney(item.total, 'NGN')}</Text>
                    </View>
                    {bulkForm.items.length > 1 ? (
                      <TouchableOpacity onPress={() => removeBulkItem(index)}>
                        <Text style={[styles.removeLineText, { color: colors.error }]}>Remove line</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                <Text style={[styles.invoiceTotal, { color: colors.textPrimary }]}>
                  PER STUDENT {formatMoney(bulkForm.items.reduce((sum, item) => sum + item.total, 0), 'NGN')}
                </Text>
              </View>

              <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>NOTES</Text>
                <TextInput
                  value={bulkForm.notes}
                  onChangeText={(value) => setBulkForm((current) => ({ ...current, notes: value }))}
                  placeholder="Optional note added to every invoice"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={[styles.formInput, styles.formArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                />
              </View>
            </ScrollView>

            <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => setShowBulkCreate(false)}>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>CLOSE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={createBulkInvoices} disabled={savingInvoice}>
                <Text style={styles.actionPrimaryText}>{savingInvoice ? 'ISSUING...' : 'ISSUE BULK INVOICES'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  createRowGroup: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md, gap: SPACING.sm },
  createRow: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  createBtn: { minHeight: 46, borderWidth: 1, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { color: '#fff', fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1.2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  statCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.md },
  statLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 1.5, marginBottom: 6 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md },
  statMeta: { fontFamily: FONT_FAMILY.body, fontSize: 11, marginTop: 4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  searchIcon: { fontFamily: FONT_FAMILY.mono, fontSize: 12 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: 13 },
  filters: { marginBottom: SPACING.lg },
  filterRow: { paddingHorizontal: SPACING.xl, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, borderWidth: 1 },
  chipText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },
  list: { paddingHorizontal: SPACING.xl, gap: SPACING.md, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.lg, gap: SPACING.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  targetBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, flex: 1, marginRight: SPACING.sm },
  targetIcon: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 1 },
  targetText: { flex: 1, fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 0.8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.xs, borderWidth: 1 },
  badgeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.md },
  invTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 14, lineHeight: 20 },
  invNumber: { fontFamily: FONT_FAMILY.mono, fontSize: 10, marginTop: 5 },
  amount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, textAlign: 'right' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  meta: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 0.8 },
  empty: { alignItems: 'center', paddingTop: 96, gap: 12 },
  emptyIcon: { fontFamily: FONT_FAMILY.display, fontSize: 42 },
  emptyText: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.xl, borderBottomWidth: 1, alignItems: 'flex-start' },
  modalEyebrow: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 2, marginBottom: 8 },
  modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  modalSub: { fontFamily: FONT_FAMILY.body, fontSize: 12, marginTop: 4 },
  closeBtn: { width: 40, height: 40, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12 },
  modalScroll: { padding: SPACING.xl, gap: SPACING.lg },
  detailHero: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.lg },
  detailStatus: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 1.5, marginBottom: 8 },
  detailAmount: { fontFamily: FONT_FAMILY.display, fontSize: 28, marginBottom: 8 },
  detailMeta: { fontFamily: FONT_FAMILY.body, fontSize: 12, marginTop: 2 },
  section: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.lg },
  formLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wide, marginTop: SPACING.md, marginBottom: 8 },
  formInput: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 12, fontFamily: FONT_FAMILY.body, fontSize: 13 },
  formArea: { minHeight: 86, textAlignVertical: 'top' },
  lineBuilderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  addLineText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wide },
  builderCard: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.sm },
  builderRow: { flexDirection: 'row', gap: SPACING.sm },
  builderHalf: { flex: 1 },
  builderFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineTotalLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 1 },
  lineTotalValue: { fontFamily: FONT_FAMILY.display, fontSize: 14 },
  removeLineText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wide },
  invoiceTotal: { marginTop: SPACING.sm, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, textAlign: 'right' },
  sectionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, letterSpacing: LETTER_SPACING.wide, marginBottom: SPACING.md },
  sectionBody: { fontFamily: FONT_FAMILY.body, fontSize: 12, lineHeight: 20 },
  lineItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1 },
  lineTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 13 },
  lineMeta: { fontFamily: FONT_FAMILY.body, fontSize: 11, marginTop: 4 },
  lineTotal: { fontFamily: FONT_FAMILY.display, fontSize: 14 },
  accountCard: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.md, marginTop: SPACING.sm },
  accountNote: { fontFamily: FONT_FAMILY.body, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  actionBar: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.xl, borderTopWidth: 1 },
  actionBtn: { flex: 1, minHeight: 48, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
  actionText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1.2 },
  actionPrimaryText: { color: '#fff', fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1.2 },
});
