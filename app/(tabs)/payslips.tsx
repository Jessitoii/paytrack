import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  X,
  UploadCloud,
} from 'lucide-react-native';
import { payslipRepository } from '../../src/database';
import { formatEUR, formatDateShort } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

export default function PayslipsScreen() {
  const queryClient = useQueryClient();
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);
  const [reconcileModalVisible, setReconcileModalVisible] = useState(false);

  const { data: payslips, isLoading } = useQuery({
    queryKey: ['localPayslips'],
    queryFn: () => payslipRepository.listPayslips(),
  });

  const { data: reconciliationData, refetch: refetchReconciliation } = useQuery({
    queryKey: ['localReconciliation', selectedPayslipId],
    queryFn: () => (selectedPayslipId ? payslipRepository.reconcilePayslip(selectedPayslipId) : null),
    enabled: !!selectedPayslipId,
  });

  const handleOpenReconcile = (id: string) => {
    setSelectedPayslipId(id);
    setReconcileModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Carrière Personeelsdiensten</Text>
            <Text style={styles.headerTitle}>Official Payslips</Text>
          </View>
          <View style={styles.statusBadge}>
            <ShieldCheck size={14} color={colors.primaryLight} />
            <Text style={styles.statusBadgeText}>Local Storage</Text>
          </View>
        </View>

        {/* Hero Info Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <Building2 size={18} color={colors.primary} />
            <Text style={styles.heroTitle}>Deterministic Payslip Engine</Text>
          </View>
          <Text style={styles.heroSubtitle}>
            Official payslips stored locally and reconciled line-by-line against your recorded work sessions.
          </Text>
        </View>

        {/* Payslip History List */}
        <View style={styles.sectionHeaderRow}>
          <FileText size={16} color={colors.textSecondary} />
          <Text style={styles.sectionTitle}>CONFIRMED STATEMENTS</Text>
        </View>

        {payslips?.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No payslips imported yet.</Text>
          </View>
        ) : (
          payslips?.map((slip: any) => (
            <TouchableOpacity
              key={slip.id}
              onPress={() => handleOpenReconcile(slip.id)}
              activeOpacity={0.75}
              style={styles.slipCard}
            >
              <View style={styles.slipCardHeader}>
                <View>
                  <Text style={styles.slipFileName}>{slip.fileName}</Text>
                  <Text style={styles.slipPeriod}>
                    Period: {formatDateShort(slip.periodStart)} – {formatDateShort(slip.periodEnd)}
                  </Text>
                </View>
                <View style={styles.confirmedPill}>
                  <CheckCircle2 size={12} color={colors.primaryLight} />
                  <Text style={styles.confirmedPillText}>Confirmed</Text>
                </View>
              </View>

              <View style={styles.slipAmountsRow}>
                <View style={styles.slipAmountCol}>
                  <Text style={styles.amountColLabel}>Gross</Text>
                  <Text style={styles.grossAmountText}>{formatEUR(slip.totalGross)}</Text>
                </View>
                <View style={styles.slipAmountCol}>
                  <Text style={styles.amountColLabel}>Net Payout</Text>
                  <Text style={styles.netAmountText}>{formatEUR(slip.totalNet)}</Text>
                </View>
                <View style={styles.slipAmountCol}>
                  <Text style={styles.amountColLabel}>Bank Payout</Text>
                  <Text style={styles.bankAmountText}>{formatEUR(slip.bankPayment)}</Text>
                </View>
              </View>

              <View style={styles.reconcileActionRow}>
                <Text style={styles.reconcileActionText}>Reconcile against work sessions</Text>
                <ArrowRight size={14} color={colors.primaryLight} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Reconciliation Modal */}
      <Modal visible={reconcileModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Payslip Reconciliation</Text>
                <Text style={styles.modalSubtitle}>Line-by-Line Engine Audit</Text>
              </View>
              <TouchableOpacity
                onPress={() => setReconcileModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Reconciliation Status Badge */}
            <View
              style={[
                styles.reconcileStatusCard,
                reconciliationData?.reconciliation?.matchStatus === 'EXACT_MATCH'
                  ? styles.matchExact
                  : styles.matchVariance,
              ]}
            >
              <CheckCircle2
                size={16}
                color={
                  reconciliationData?.reconciliation?.matchStatus === 'EXACT_MATCH'
                    ? colors.primaryLight
                    : colors.amber
                }
              />
              <Text style={styles.reconcileStatusText}>
                {reconciliationData?.reconciliation?.matchStatus === 'EXACT_MATCH'
                  ? 'Deterministic Exact Match (100% Accuracy)'
                  : 'Audited with Minor Variance (< €0.50)'}
              </Text>
            </View>

            {/* Line Items Comparison Table */}
            <ScrollView style={{ maxHeight: 260, marginVertical: 10 }}>
              {reconciliationData?.reconciliation?.lineItems?.map((item: any, idx: number) => (
                <View key={idx} style={styles.lineItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineItemName}>{item.name}</Text>
                    <Text style={styles.lineItemEstimate}>
                      Estimated: {formatEUR(item.estimatedAmount)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.lineItemActual}>Actual: {formatEUR(item.actualAmount)}</Text>
                    <Text
                      style={[
                        styles.lineItemDiff,
                        item.difference === 0 ? { color: colors.primaryLight } : { color: colors.amber },
                      ]}
                    >
                      Diff: {formatEUR(item.difference)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setReconcileModalVisible(false)}
              style={styles.closeModalButton}
            >
              <Text style={styles.closeModalButtonText}>Close Audit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  statusBadgeText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },

  // Hero Card
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    marginBottom: 20,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    alignItems: 'center',
  },
  emptyCardText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
  },

  // Slip Card
  slipCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    marginBottom: 12,
  },
  slipCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  slipFileName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  slipPeriod: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  confirmedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  confirmedPillText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  slipAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 12,
  },
  slipAmountCol: {
    flex: 1,
  },
  amountColLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
  },
  grossAmountText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  netAmountText: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  bankAmountText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  reconcileActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reconcileActionText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reconcileStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
  },
  matchExact: {
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  matchVariance: {
    backgroundColor: colors.amberBg,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  reconcileStatusText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  lineItemName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  lineItemEstimate: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  lineItemActual: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  lineItemDiff: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  closeModalButton: {
    backgroundColor: colors.cardElevated,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  closeModalButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
