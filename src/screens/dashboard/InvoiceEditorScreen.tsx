import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useTheme } from '../../contexts/ThemeContext';
import { invoicePDFService, InvoiceItem } from '../../services/invoicePDF.service';
import { SPACING, RADIUS } from '../../constants/spacing';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';

/**
 * InvoiceEditorScreen - Mobile port of the Smart Document Editor.
 */
export default function InvoiceEditorScreen({ route, navigation }: any) {
  const { invoiceData } = route.params || {};
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [items, setItems] = useState<InvoiceItem[]>(
    invoiceData?.items || [{ description: 'Tuition Fee', quantity: 1, unit_price: 50000, total: 50000 }]
  );
  const [template, setTemplate] = useState<'classic' | 'bold'>('classic');
  const [isGenerating, setIsGenerating] = useState(false);

  const totalAmount = useMemo(() => items.reduce((acc, item) => acc + item.total, 0), [items]);

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, key: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index] };
    
    if (key === 'description') {
      item.description = value;
    } else {
      const numVal = Number(value) || 0;
      (item as any)[key] = numVal;
      item.total = item.quantity * item.unit_price;
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await invoicePDFService.generateAndShare({
        number: invoiceData?.invoice_number || invoiceData?.number || `INV-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleDateString('en-GB'),
        items,
        amount: totalAmount,
        currency: invoiceData?.currency || 'NGN',
        studentName: invoiceData?.studentName || 'Student Name',
        schoolName: invoiceData?.schoolName || 'Rillcod Academy',
        status: invoiceData?.status || 'Pending',
      }, template);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Smart Editor"
        subtitle="Adjust line items & style"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Template Selection */}
          <Text style={styles.sectionLabel}>Select Template</Text>
          <View style={styles.templateRow}>
            <TouchableOpacity
              style={[styles.templateBtn, template === 'classic' && styles.templateBtnActive]}
              onPress={() => setTemplate('classic')}
            >
              <Ionicons name="document-text-outline" size={20} color={template === 'classic' ? '#fff' : colors.textMuted} />
              <Text style={[styles.templateText, template === 'classic' && styles.templateTextActive]}>Classic</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.templateBtn, template === 'bold' && styles.templateBtnActive]}
              onPress={() => setTemplate('bold')}
            >
              <Ionicons name="flash-outline" size={20} color={template === 'bold' ? '#fff' : colors.textMuted} />
              <Text style={[styles.templateText, template === 'bold' && styles.templateTextActive]}>Bold (Pro)</Text>
            </TouchableOpacity>
          </View>

          {/* Line Items */}
          <View style={styles.itemsHeader}>
            <Text style={styles.sectionLabel}>Line Items</Text>
            <TouchableOpacity onPress={addItem}>
              <Text style={styles.addBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, index) => (
            <MotiView
              key={index}
              from={{ opacity: 0, translateX: -10 }}
              animate={{ opacity: 1, translateX: 0 }}
              style={styles.itemCard}
            >
              <View style={styles.itemRowTop}>
                <TextInput
                  style={styles.descInput}
                  placeholder="Item description..."
                  placeholderTextColor={colors.textMuted}
                  value={item.description}
                  onChangeText={(v) => updateItem(index, 'description', v)}
                />
                <TouchableOpacity onPress={() => removeItem(index)}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.itemRowBottom}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Qty</Text>
                  <TextInput
                    style={styles.numInput}
                    keyboardType="numeric"
                    value={String(item.quantity)}
                    onChangeText={(v) => updateItem(index, 'quantity', v)}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Price</Text>
                  <TextInput
                    style={styles.numInput}
                    keyboardType="numeric"
                    value={String(item.unit_price)}
                    onChangeText={(v) => updateItem(index, 'unit_price', v)}
                  />
                </View>
                <View style={styles.totalBox}>
                  <Text style={styles.inputLabel}>Total</Text>
                  <Text style={styles.totalText}>₦{item.total.toLocaleString()}</Text>
                </View>
              </View>
            </MotiView>
          ))}

          {/* Summary Box */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₦{totalAmount.toLocaleString()}</Text>
            </View>
            <View style={[styles.summaryRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
              <Text style={styles.grandTotalValue}>₦{totalAmount.toLocaleString()}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Action Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: colors.primary }]}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Text style={styles.generateBtnText}>Generating PDF...</Text>
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.generateBtnText}>Share Smart Document</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: SPACING.xl, paddingBottom: 120 },
  sectionLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.md },
  templateRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xl },
  templateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  templateBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  templateText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, color: colors.textSecondary },
  templateTextActive: { color: '#fff' },
  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  addBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, color: colors.primary },
  itemCard: { backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: colors.borderLight },
  itemRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  descInput: { flex: 1, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, color: colors.textPrimary, padding: 0 },
  itemRowBottom: { flexDirection: 'row', gap: SPACING.lg },
  inputGroup: { flex: 1 },
  inputLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  numInput: { backgroundColor: colors.bg, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 6, color: colors.textPrimary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 12 },
  totalBox: { flex: 1.5, alignItems: 'flex-end', justifyContent: 'flex-end' },
  totalText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: colors.textPrimary },
  summaryCard: { marginTop: SPACING.xl, padding: SPACING.lg, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, borderTopWidth: 2, borderTopColor: colors.primary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontFamily: FONT_FAMILY.body, color: colors.textSecondary, fontSize: 14 },
  summaryValue: { fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary, fontSize: 14 },
  grandTotalRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  grandTotalLabel: { fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary, fontSize: 12 },
  grandTotalValue: { fontFamily: FONT_FAMILY.display, color: colors.primary, fontSize: 18 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, padding: SPACING.xl, borderTopWidth: 1, borderTopColor: colors.borderLight },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: RADIUS.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  generateBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 16, color: '#fff' },
});
