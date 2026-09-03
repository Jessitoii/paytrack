import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Building2,
  X,
  UploadCloud,
  Trash2,
  Plus,
  Sliders,
  Sparkles,
} from 'lucide-react-native';
import { payslipRepository } from '../../src/database';
import { useDatabaseRefresh } from '../../src/hooks/useDatabaseRefresh';
import { formatEUR, formatDateShort } from '../../src/lib/formatters';
import { useTheme } from '../../src/theme/ThemeContext';
import { useNotification } from '../../src/components/NotificationContext';
import { parsePayslipDocument, ParsedPayslip } from '../../src/payslips/parser';
import { readLocalPdfFile } from '../../src/payslips/parser/localFileReader';

export default function PayslipsScreen() {
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const { showSuccess, showError, showWarning, confirm } = useNotification();

  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);
  const [reconcileModalVisible, setReconcileModalVisible] = useState(false);

  // Upload & Review Modal State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [reviewFileName, setReviewFileName] = useState('');
  const [reviewFileUri, setReviewFileUri] = useState('');
  const [reviewPeriodStart, setReviewPeriodStart] = useState('');
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState('');
  const [reviewGross, setReviewGross] = useState('');
  const [reviewNet, setReviewNet] = useState('');
  const [reviewBank, setReviewBank] = useState('');
  const [extractedComponents, setExtractedComponents] = useState<any[]>([]);
  const [extractedFullData, setExtractedFullData] = useState<ParsedPayslip | null>(null);

  // Queries
  const { data: payslips, isLoading, refetch: refetchPayslips } = useQuery({
    queryKey: ['localPayslips'],
    queryFn: () => payslipRepository.listPayslips(),
  });

  const { data: selectedPayslip, refetch: refetchSelected } = useQuery({
    queryKey: ['localPayslipDetail', selectedPayslipId],
    queryFn: () => (selectedPayslipId ? payslipRepository.getPayslipById(selectedPayslipId) : null),
    enabled: !!selectedPayslipId,
  });

  const { data: reconciliationData, refetch: refetchReconciliation } = useQuery({
    queryKey: ['localReconciliation', selectedPayslipId],
    queryFn: () => (selectedPayslipId ? payslipRepository.reconcilePayslip(selectedPayslipId) : null),
    enabled: !!selectedPayslipId,
  });

  // Calibration suggestions query
  const { data: calibrations, refetch: refetchCalibrations } = useQuery({
    queryKey: ['localCalibrations'],
    queryFn: () => payslipRepository.generateCalibrationSuggestions(),
  });

  useDatabaseRefresh(['payslips_changed', 'work_changed', 'settings_changed'], () => {
    refetchPayslips();
    refetchCalibrations();
    if (selectedPayslipId) {
      refetchSelected();
      refetchReconciliation();
    }
  });

  // Mutations
  const savePayslipMutation = useMutation({
    mutationFn: (payload: any) => payslipRepository.savePayslip(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localPayslips'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localCalibrations'] });
      setReviewModalVisible(false);
      showSuccess('Payslip Confirmed', 'Official payslip document recorded to SQLite database.');
    },
    onError: (err: any) => showError('Save Error', err.message || 'Failed to record payslip'),
  });

  const deletePayslipMutation = useMutation({
    mutationFn: (id: string) => payslipRepository.deletePayslip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localPayslips'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localCalibrations'] });
      setReconcileModalVisible(false);
      setSelectedPayslipId(null);
      showSuccess('Payslip Removed', 'Payslip record successfully deleted.');
    },
    onError: (err: any) => showError('Delete Error', err.message),
  });

  const applyCalibrationMutation = useMutation({
    mutationFn: (id: string) => payslipRepository.applyCalibration(id),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['localCalibrations'] });
      queryClient.invalidateQueries({ queryKey: ['localPayrollConfigurations'] });
      showSuccess('Adjustment Applied', `Updated ${res.updatedParameter} to ${formatEUR(res.newValue)}.`);
    },
    onError: (err: any) => showError('Calibration Error', err.message),
  });

  // Document Picker & Deterministic Extraction
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setReviewFileName(asset.name || 'payslip.pdf');
      setReviewFileUri(asset.uri || '');
      setIsParsing(true);

      const now = new Date();
      const prevWeekStart = new Date(now.getTime() - 7 * 86400000);
      setReviewPeriodStart(prevWeekStart.toISOString().substring(0, 10));
      setReviewPeriodEnd(now.toISOString().substring(0, 10));

      const fileResult = await readLocalPdfFile(
        asset.uri,
        asset.name || 'payslip.pdf',
        asset.size,
        asset.mimeType || 'application/pdf'
      );

      if (!fileResult.success || !fileResult.bytes || !fileResult.readable) {
        setIsParsing(false);
        showError(
          'File Read Error',
          fileResult.error || 'The selected PDF document could not be read. Please check file permissions.'
        );
        return;
      }

      if (fileResult.cachedUri) {
        setReviewFileUri(fileResult.cachedUri);
      }

      console.log(`[PAYSLIP] Initiating deterministic parsing for ${fileResult.bytes.byteLength} bytes...`);
      let parsed: ParsedPayslip | null = null;
      try {
        parsed = parsePayslipDocument(fileResult.bytes);
      } catch (parseErr: any) {
        console.error('[PAYSLIP] Parsing exception:', parseErr);
      }

      setIsParsing(false);

      if (parsed) {
        if (!parsed.success) {
          if (parsed.isScannedImage) {
            showError(
              'Scanned PDF Detected',
              'Could not extract text from this PDF: Scanned or image-only document detected. Please enter fields manually or upload a digital text-based payslip.'
            );
          } else {
            showWarning(
              'Text Extraction Warning',
              parsed.error || 'Could not automatically find all totals. Please review and complete values manually.'
            );
          }
          setReviewGross('');
          setReviewNet('');
          setReviewBank('');
          setExtractedComponents([]);
          setExtractedFullData(null);
        } else {
          showSuccess(
            'Payslip Parsed Deterministically',
            `Week ${parsed.period.weekNumber ?? ''} (${formatEUR(parsed.wageDetails.totalGross ?? 0)} gross).`
          );
          setReviewGross(parsed.wageDetails.totalGross ? String(parsed.wageDetails.totalGross) : '');
          setReviewNet(parsed.wageDetails.totalNet ? String(parsed.wageDetails.totalNet) : '');
          setReviewBank(parsed.wageDetails.bankPayout ? String(parsed.wageDetails.bankPayout) : '');
          if (parsed.period.startDate) setReviewPeriodStart(parsed.period.startDate);
          if (parsed.period.endDate) setReviewPeriodEnd(parsed.period.endDate);
          setExtractedComponents(parsed.components || []);
          setExtractedFullData(parsed);
        }
      } else {
        showError('File Read Error', 'Could not read PDF bytes from device storage. Please check permissions.');
        setReviewGross('');
        setReviewNet('');
        setReviewBank('');
        setExtractedComponents([]);
        setExtractedFullData(null);
      }

      setReviewModalVisible(true);
    } catch (err: any) {
      setIsParsing(false);
      showError('Document Error', err.message || 'Failed to select document.');
    }
  };

  const handleConfirmReview = () => {
    const grossNum = parseFloat(reviewGross.replace(',', '.'));
    const netNum = parseFloat(reviewNet.replace(',', '.'));
    const bankNum = parseFloat(reviewBank.replace(',', '.'));

    if (isNaN(grossNum) || isNaN(netNum) || isNaN(bankNum)) {
      showError('Validation Error', 'Please enter valid numerical amounts for gross, net, and bank payout.');
      return;
    }

    // Use extracted components if available, or generate minimal valid components without fake numbers
    let components = extractedComponents;
    if (!components || components.length === 0) {
      components = [
        { code: '1000', name: 'Bruto Loon', category: 'EARNING', amount: grossNum },
        { code: '3000', name: 'Inhoudingen / Belastingen', category: 'DEDUCTION', amount: Number(Math.max(0, grossNum - netNum).toFixed(2)) },
      ];
    }


    savePayslipMutation.mutate({
      fileName: reviewFileName || 'payslip.pdf',
      localFileUri: reviewFileUri || undefined,
      periodStart: reviewPeriodStart,
      periodEnd: reviewPeriodEnd,
      totalGross: grossNum,
      totalNet: netNum,
      bankPayment: bankNum,
      extractedData: extractedFullData || {
        rawFileName: reviewFileName,
        employer: 'Carrière Personeelsdiensten',
        role: 'Order Picker',
        location: 'Bleiswijk',
      },
      components,
    });
  };

  const handleOpenReconcile = (id: string) => {
    setSelectedPayslipId(id);
    setReconcileModalVisible(true);
  };

  const pendingCalibrations = calibrations?.filter((c: any) => c.status === 'PENDING') || [];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Carrière Personeelsdiensten</Text>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Official Payslips</Text>
          </View>

          <TouchableOpacity
            onPress={handlePickDocument}
            activeOpacity={0.85}
            style={[styles.uploadButton, { backgroundColor: colors.primary }]}
            disabled={isParsing}
          >
            {isParsing ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <UploadCloud size={15} color={colors.textInverse} />
                <Text style={[styles.uploadButtonText, { color: colors.textInverse }]}>Upload PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Hero Info Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.heroHeaderRow}>
            <Building2 size={18} color={colors.primary} />
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Deterministic Payslip Engine</Text>
          </View>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Official payslips parsed without external AI, stored locally in SQLite, and reconciled line-by-line against your recorded work sessions.
          </Text>
        </View>

        {/* Calibration Recommendations Banner */}
        {pendingCalibrations.length > 0 && (
          <View style={[styles.calibrationSection, { backgroundColor: colors.card, borderColor: colors.amber }]}>
            <View style={styles.calibrationHeaderRow}>
              <Sparkles size={18} color={colors.amber} />
              <Text style={[styles.calibrationSectionTitle, { color: colors.textPrimary }]}>
                Calibration Recommendations ({pendingCalibrations.length})
              </Text>
            </View>
            <Text style={[styles.calibrationSubtitle, { color: colors.textSecondary }]}>
              Persistent rate differences detected across confirmed payslips. Apply adjustments to sync your timesheet engine:
            </Text>

            {pendingCalibrations.map((cal: any) => (
              <View
                key={cal.id}
                style={[
                  styles.calibrationCard,
                  { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.calibrationParamName, { color: colors.textPrimary }]}>
                    {cal.parameterName === 'baseHourlyRate' ? 'Base Hourly Rate' : cal.parameterName}
                  </Text>
                  <Text style={[styles.calibrationReason, { color: colors.textTertiary }]}>
                    {cal.reason}
                  </Text>
                  <View style={styles.calibValuesRow}>
                    <Text style={[styles.calibOldVal, { color: colors.danger }]}>
                      Current: {formatEUR(cal.oldValue)}
                    </Text>
                    <ArrowRight size={12} color={colors.textTertiary} />
                    <Text style={[styles.calibNewVal, { color: colors.primary }]}>
                      Suggested: {formatEUR(cal.suggestedValue)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    confirm({
                      title: 'Apply Calibration',
                      message: `Update payroll config ${cal.parameterName} from ${formatEUR(cal.oldValue)} to ${formatEUR(cal.suggestedValue)}?`,
                      confirmText: 'Apply Adjustment',
                      onConfirm: () => applyCalibrationMutation.mutate(cal.id),
                    });
                  }}
                  style={[styles.applyCalibBtn, { backgroundColor: colors.primary }]}
                  disabled={applyCalibrationMutation.isPending}
                >
                  <Text style={[styles.applyCalibBtnText, { color: colors.textInverse }]}>Apply</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Payslip History List */}
        <View style={styles.sectionHeaderRow}>
          <FileText size={16} color={colors.textSecondary} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CONFIRMED STATEMENTS</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : payslips?.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.emptyCardText, { color: colors.textTertiary }]}>No payslips uploaded yet.</Text>
            <TouchableOpacity onPress={handlePickDocument} style={[styles.emptyUploadBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
              <Plus size={14} color={colors.primary} />
              <Text style={[styles.emptyUploadBtnText, { color: colors.primary }]}>Upload First Payslip PDF</Text>
            </TouchableOpacity>
          </View>
        ) : (
          payslips?.map((slip: any) => (
            <TouchableOpacity
              key={slip.id}
              onPress={() => handleOpenReconcile(slip.id)}
              activeOpacity={0.75}
              style={[styles.slipCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              <View style={styles.slipCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.slipFileName, { color: colors.textPrimary }]}>{slip.fileName}</Text>
                  <Text style={[styles.slipPeriod, { color: colors.textSecondary }]}>
                    Period: {formatDateShort(slip.periodStart)} – {formatDateShort(slip.periodEnd)}
                  </Text>
                </View>

                <View style={[styles.confirmedPill, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                  <CheckCircle2 size={12} color={colors.primary} />
                  <Text style={[styles.confirmedPillText, { color: colors.primary }]}>
                    {slip.parsingStatus || 'CONFIRMED'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.slipAmountsRow,
                  { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder },
                ]}
              >
                <View style={styles.slipAmountCol}>
                  <Text style={[styles.amountColLabel, { color: colors.textTertiary }]}>Gross</Text>
                  <Text style={[styles.grossAmountText, { color: colors.textPrimary }]}>{formatEUR(slip.totalGross)}</Text>
                </View>
                <View style={styles.slipAmountCol}>
                  <Text style={[styles.amountColLabel, { color: colors.textTertiary }]}>Net Pay</Text>
                  <Text style={[styles.netAmountText, { color: colors.textPrimary }]}>{formatEUR(slip.totalNet)}</Text>
                </View>
                <View style={styles.slipAmountCol}>
                  <Text style={[styles.amountColLabel, { color: colors.textTertiary }]}>Bank Payout</Text>
                  <Text style={[styles.bankAmountText, { color: colors.primary }]}>{formatEUR(slip.bankPayment)}</Text>
                </View>
              </View>

              <View style={styles.reconcileActionRow}>
                <Text style={[styles.reconcileActionText, { color: colors.primary }]}>View Details & Reconcile Work Sessions</Text>
                <ArrowRight size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* 1. Review & Edit Extracted Values Modal */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Review Extracted Values</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{reviewFileName || 'PDF Document'}</Text>
              </View>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PERIOD START (YYYY-MM-DD)</Text>
              <TextInput
                value={reviewPeriodStart}
                onChangeText={setReviewPeriodStart}
                placeholder="2026-08-24"
                placeholderTextColor={colors.textTertiary}
                style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PERIOD END (YYYY-MM-DD)</Text>
              <TextInput
                value={reviewPeriodEnd}
                onChangeText={setReviewPeriodEnd}
                placeholder="2026-08-30"
                placeholderTextColor={colors.textTertiary}
                style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>TOTAL GROSS (€)</Text>
              <TextInput
                value={reviewGross}
                onChangeText={setReviewGross}
                keyboardType="decimal-pad"
                placeholder="e.g. 556.54"
                placeholderTextColor={colors.textTertiary}
                style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>TOTAL NET PAY (€)</Text>
              <TextInput
                value={reviewNet}
                onChangeText={setReviewNet}
                keyboardType="decimal-pad"
                placeholder="e.g. 485.75"
                placeholderTextColor={colors.textTertiary}
                style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ACTUAL BANK PAYOUT (€)</Text>
              <TextInput
                value={reviewBank}
                onChangeText={setReviewBank}
                keyboardType="decimal-pad"
                placeholder="e.g. 453.23"
                placeholderTextColor={colors.textTertiary}
                style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
              />
            </ScrollView>

            <TouchableOpacity
              onPress={handleConfirmReview}
              disabled={savePayslipMutation.isPending}
              activeOpacity={0.85}
              style={[styles.confirmSaveButton, { backgroundColor: colors.primary }]}
            >
              {savePayslipMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={[styles.confirmSaveButtonText, { color: colors.textInverse }]}>Confirm & Save to SQLite</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Reconciliation & Line Components Detail Modal */}
      <Modal visible={reconcileModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Payslip Audit & Reconciliation</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {selectedPayslip?.fileName || 'Official Statement'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReconcileModalVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }}>
              {/* Reconciliation Status Badge */}
              <View
                style={[
                  styles.reconcileStatusCard,
                  reconciliationData?.reconciliation?.matchStatus === 'EXACT_MATCH'
                    ? [styles.matchExact, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]
                    : [styles.matchVariance, { backgroundColor: colors.amberBg, borderColor: colors.amber }],
                ]}
              >
                <CheckCircle2
                  size={16}
                  color={
                    reconciliationData?.reconciliation?.matchStatus === 'EXACT_MATCH'
                      ? colors.primary
                      : colors.amber
                  }
                />
                <Text style={[styles.reconcileStatusText, { color: colors.textPrimary }]}>
                  {reconciliationData?.reconciliation?.matchStatus === 'EXACT_MATCH'
                    ? 'Deterministic Match (< €0.50 variance)'
                    : 'Variance Detected against Recorded Shifts'}
                </Text>
              </View>

              {/* Line Items Comparison Table */}
              <Text style={[styles.sectionHeaderLabel, { color: colors.textSecondary }]}>LINE-BY-LINE AUDIT</Text>
              <View style={[styles.comparisonTable, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}>
                {reconciliationData?.reconciliation?.lineItems?.map((item: any, idx: number) => (
                  <View key={idx} style={[styles.lineItemRow, { borderBottomColor: colors.cardBorder }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lineItemName, { color: colors.textPrimary }]}>{item.name}</Text>
                      <Text style={[styles.lineItemSub, { color: colors.textTertiary }]}>
                        Estimated: {formatEUR(item.estimatedAmount)} • Actual: {formatEUR(item.actualAmount)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.diffAmount,
                          Math.abs(item.difference) <= 0.5 ? { color: colors.primary } : { color: colors.amber },
                        ]}
                      >
                        {item.difference === 0
                          ? '±€0.00'
                          : `${item.difference > 0 ? '+' : ''}${formatEUR(item.difference)}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Components Breakdown */}
              {selectedPayslip?.components && selectedPayslip.components.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.sectionHeaderLabel, { color: colors.textSecondary }]}>STATEMENT COMPONENTS</Text>
                  {selectedPayslip.components.map((comp: any) => (
                    <View
                      key={comp.id}
                      style={[
                        styles.componentRow,
                        { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder },
                      ]}
                    >
                      <View>
                        <Text style={[styles.componentName, { color: colors.textPrimary }]}>{comp.name}</Text>
                        <Text style={[styles.componentSub, { color: colors.textTertiary }]}>Code {comp.code} • {comp.category}</Text>
                      </View>
                      <Text
                        style={[
                          styles.componentAmount,
                          comp.category === 'DEDUCTION' ? { color: colors.danger } : { color: colors.primary },
                        ]}
                      >
                        {comp.category === 'DEDUCTION' ? '-' : '+'}{formatEUR(comp.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.auditActionsRow}>
              <TouchableOpacity
                onPress={() => {
                  if (selectedPayslipId) {
                    confirm({
                      title: 'Delete Payslip',
                      message: 'Are you sure you want to remove this official payslip record?',
                      confirmText: 'Delete',
                      isDestructive: true,
                      onConfirm: () => deletePayslipMutation.mutate(selectedPayslipId),
                    });
                  }
                }}
                style={[styles.deleteAuditBtn, { backgroundColor: colors.dangerBg }]}
              >
                <Trash2 size={16} color={colors.danger} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setReconcileModalVisible(false)}
                style={[styles.doneAuditBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.doneAuditBtnText, { color: colors.textInverse }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
    fontSize: 13,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  calibrationSection: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  calibrationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  calibrationSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  calibrationSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  calibrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  calibrationParamName: {
    fontSize: 14,
    fontWeight: '700',
  },
  calibrationReason: {
    fontSize: 11,
    marginTop: 2,
  },
  calibValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  calibOldVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  calibNewVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  applyCalibBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyCalibBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionHeaderLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  emptyUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  emptyUploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  slipCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  slipCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  slipFileName: {
    fontSize: 15,
    fontWeight: '800',
  },
  slipPeriod: {
    fontSize: 12,
    marginTop: 2,
  },
  confirmedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  confirmedPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  slipAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  slipAmountCol: {
    flex: 1,
  },
  amountColLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  grossAmountText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  netAmountText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  bankAmountText: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  reconcileActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reconcileActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    padding: 22,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  confirmSaveButton: {
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  confirmSaveButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  reconcileStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  matchExact: {},
  matchVariance: {},
  reconcileStatusText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  comparisonTable: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  lineItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  lineItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  diffAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  componentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  componentName: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  componentSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  componentAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  auditActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  deleteAuditBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneAuditBtn: {
    flex: 1,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneAuditBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
