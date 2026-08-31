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
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  FileCheck2,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { formatEUR, formatDateShort } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

export default function PayslipsScreen() {
  const queryClient = useQueryClient();
  const [reconcileModalVisible, setReconcileModalVisible] = useState(false);
  const [reconcileData, setReconcileData] = useState<any>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  const { data: payslipsData, isLoading, refetch } = useQuery({
    queryKey: ['payslips'],
    queryFn: () => api.listPayslips(),
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: { fileBase64: string; fileName: string }) =>
      api.uploadPayslip(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payslips'] });
      Alert.alert(
        'Payslip Parsed Successfully',
        `Week ${res.extractedData?.payrollPeriod?.weekNumber || ''} parsed with ${res.extractedData?.totals?.totalGross ? formatEUR(res.extractedData.totals.totalGross) : ''} gross pay.`
      );
    },
    onError: (err: any) => Alert.alert('Upload Error', err.message),
  });

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      uploadMutation.mutate({
        fileBase64: base64,
        fileName: file.name,
      });
    } catch (err: any) {
      Alert.alert('File Picker Error', err.message);
    }
  };

  const handleOpenReconcile = async (payslipId: string) => {
    try {
      setIsReconciling(true);
      const res = await api.reconcilePayslip(payslipId);
      setReconcileData(res);
      setReconcileModalVisible(true);
    } catch (err: any) {
      Alert.alert('Reconciliation Error', err.message);
    } finally {
      setIsReconciling(false);
    }
  };

  const payslips = payslipsData?.payslips || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Official Statements</Text>
            <Text style={styles.headerTitle}>Payslips & AI</Text>
          </View>
          <View style={styles.aiBadge}>
            <Sparkles size={14} color={colors.primaryLight} />
            <Text style={styles.aiBadgeText}>AI Reconciliation</Text>
          </View>
        </View>

        {/* 1. Upload Payslip Box */}
        <TouchableOpacity
          onPress={handlePickDocument}
          disabled={uploadMutation.isPending}
          activeOpacity={0.8}
          style={styles.uploadCard}
        >
          <View style={styles.uploadIconWrapper}>
            <Upload size={24} color={colors.primary} />
          </View>
          <Text style={styles.uploadTitle}>
            {uploadMutation.isPending ? 'Analyzing PDF with AI...' : 'Upload Official Payslip (PDF)'}
          </Text>
          <Text style={styles.uploadSubtitle}>
            Extract wages, deductions, allowances, and verify bank payments
          </Text>

          {uploadMutation.isPending && (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
          )}
        </TouchableOpacity>

        {/* 2. Payslips Document List */}
        <View style={styles.sectionHeaderRow}>
          <FileText size={16} color={colors.textSecondary} />
          <Text style={styles.sectionTitle}>CONFIRMED STATEMENTS</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
        ) : payslips.length === 0 ? (
          <View style={styles.emptyCard}>
            <FileCheck2 size={36} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Payslips Uploaded</Text>
            <Text style={styles.emptySubtitle}>
              Upload your Carrière / Albert Heijn payslip PDF above to audit your payroll.
            </Text>
          </View>
        ) : (
          payslips.map((ps: any) => (
            <View key={ps.id} style={styles.documentCard}>
              <View style={styles.docCardTop}>
                <View>
                  <Text style={styles.docPeriodTitle}>
                    {formatDateShort(ps.periodStart)} – {formatDateShort(ps.periodEnd)}
                  </Text>
                  <Text style={styles.docFileName}>{ps.fileName}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    ps.parsingStatus === 'CONFIRMED'
                      ? styles.statusPillConfirmed
                      : styles.statusPillParsed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      ps.parsingStatus === 'CONFIRMED'
                        ? styles.statusTextConfirmed
                        : styles.statusTextParsed,
                    ]}
                  >
                    {ps.parsingStatus}
                  </Text>
                </View>
              </View>

              <View style={styles.docDivider} />

              <View style={styles.docFinancialGrid}>
                <View style={styles.financialCol}>
                  <Text style={styles.finLabel}>Total Gross</Text>
                  <Text style={styles.finValue}>{formatEUR(ps.totalGross)}</Text>
                </View>
                <View style={styles.financialCol}>
                  <Text style={styles.finLabel}>Total Net</Text>
                  <Text style={styles.finValue}>{formatEUR(ps.totalNet)}</Text>
                </View>
                <View style={styles.financialCol}>
                  <Text style={styles.finLabel}>Bank Payment</Text>
                  <Text style={styles.finBankValue}>{formatEUR(ps.bankPayment)}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleOpenReconcile(ps.id)}
                activeOpacity={0.8}
                style={styles.reconcileButton}
              >
                <Text style={styles.reconcileButtonText}>Audit & Reconcile Calculation</Text>
                <ArrowRight size={14} color={colors.primaryLight} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Reconciliation Breakdown Modal */}
      <Modal visible={reconcileModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Payroll Reconciliation</Text>
                <Text style={styles.modalSubtitle}>Estimated vs. Official Payslip</Text>
              </View>
              <TouchableOpacity
                onPress={() => setReconcileModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {reconcileData ? (
              <ScrollView style={{ maxHeight: 400 }}>
                <View style={styles.reconcileMatchCard}>
                  <ShieldCheck size={20} color={colors.primary} />
                  <Text style={styles.reconcileMatchText}>
                    Status:{' '}
                    {reconcileData.reconciliation?.matchStatus === 'EXACT_MATCH'
                      ? '100% Exact Match Verified'
                      : 'Reconciliation Verified with Minor Estimates'}
                  </Text>
                </View>

                <View style={styles.lineItemTable}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableCol, { flex: 2, color: colors.textSecondary }]}>
                      Component
                    </Text>
                    <Text
                      style={[
                        styles.tableCol,
                        { flex: 1, textAlign: 'right', color: colors.textSecondary },
                      ]}
                    >
                      Estimate
                    </Text>
                    <Text
                      style={[
                        styles.tableCol,
                        { flex: 1, textAlign: 'right', color: colors.textSecondary },
                      ]}
                    >
                      Actual
                    </Text>
                  </View>

                  {reconcileData.reconciliation?.lineItems?.map((item: any, idx: number) => (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={[styles.tableCol, { flex: 2, color: colors.textPrimary }]}>
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.tableCol,
                          { flex: 1, textAlign: 'right', color: colors.textSecondary },
                        ]}
                      >
                        {formatEUR(item.estimatedAmount)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCol,
                          { flex: 1, textAlign: 'right', color: colors.primaryLight, fontWeight: '700' },
                        ]}
                      >
                        {formatEUR(item.actualAmount)}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
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
    marginBottom: 20,
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
  aiBadge: {
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
  aiBadgeText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },

  // Upload Box
  uploadCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  uploadSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },

  // Document List
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 36,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },

  // Document Card
  documentCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    marginBottom: 14,
  },
  docCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  docPeriodTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  docFileName: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  statusPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillConfirmed: {
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusPillParsed: {
    backgroundColor: colors.blueBg,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextConfirmed: {
    color: colors.primaryLight,
  },
  statusTextParsed: {
    color: colors.blue,
  },
  docDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 12,
  },
  docFinancialGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  financialCol: {
    flex: 1,
  },
  finLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  finValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  finBankValue: {
    color: colors.primaryLight,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  reconcileButton: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reconcileButtonText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 16,
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
  reconcileMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  reconcileMatchText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  lineItemTable: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  tableCol: {
    fontSize: 12,
  },
});
