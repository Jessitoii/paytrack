import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Square,
  Coffee,
  Utensils,
  Clock,
  Coins,
  History,
  Plus,
  X,
  CheckCircle2,
  Calendar,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { formatEUR, formatMinutes, formatTimeHHMM, formatDateShort } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

export default function TrackWorkScreen() {
  const queryClient = useQueryClient();

  const [hasPaid15, setHasPaid15] = useState(true);
  const [hasUnpaid30, setHasUnpaid30] = useState(true);

  // Manual Session Modal State
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualDateStr, setManualDateStr] = useState(new Date().toISOString().substring(0, 10));
  const [manualStartTime, setManualStartTime] = useState('14:30');
  const [manualFinishTime, setManualFinishTime] = useState('23:00');
  const [manualPaid15, setManualPaid15] = useState(true);
  const [manualUnpaid30, setManualUnpaid30] = useState(true);
  const [manualNotes, setManualNotes] = useState('Manual past session entry');

  const { data: workData, isLoading, refetch } = useQuery({
    queryKey: ['workSessions'],
    queryFn: () => api.listWorkSessions(),
  });

  const activeSession = workData?.sessions?.find((s: any) => s.status === 'WORKING');
  const pastSessions = workData?.sessions?.filter((s: any) => s.status !== 'WORKING') || [];

  const startMutation = useMutation({
    mutationFn: () => api.startWork(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const finishMutation = useMutation({
    mutationFn: () => {
      const breaks = [];
      if (hasPaid15) {
        breaks.push({ type: 'PAID_15', durationMinutes: 15, isPaid: true, name: '15m Paid Break' });
      }
      if (hasUnpaid30) {
        breaks.push({ type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: '30m Unpaid Break' });
      }
      return api.finishWork(activeSession.id, { breaks });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      Alert.alert(
        'Shift Finished',
        `Rounded Finish: ${formatTimeHHMM(data.session.roundedFinish)}\nPaid Time: ${formatMinutes(data.calculation.paidMinutes)}`
      );
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const manualWorkMutation = useMutation({
    mutationFn: (payload: any) => api.createManualWork(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setManualModalVisible(false);
      Alert.alert(
        'Manual Session Saved',
        `Recorded ${formatMinutes(data.calculation.paidMinutes)} paid time.\n5-Min Rounding Ceiling: ${formatTimeHHMM(data.session.roundedFinish)}`
      );
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleSaveManualSession = () => {
    const [sh, sm] = manualStartTime.split(':').map(Number);
    const [eh, em] = manualFinishTime.split(':').map(Number);

    const baseDate = new Date(manualDateStr);

    const actualStart = new Date(baseDate);
    actualStart.setHours(sh || 14, sm || 30, 0, 0);

    const rawFinish = new Date(baseDate);
    rawFinish.setHours(eh || 23, em || 0, 0, 0);

    if (eh < sh) {
      rawFinish.setDate(rawFinish.getDate() + 1);
    }

    const breaks = [];
    if (manualPaid15) {
      breaks.push({ type: 'PAID_15', durationMinutes: 15, isPaid: true, name: '15m Paid Break' });
    }
    if (manualUnpaid30) {
      breaks.push({ type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: '30m Unpaid Break' });
    }

    manualWorkMutation.mutate({
      actualStart,
      rawFinish,
      breaks,
      notes: manualNotes || undefined,
    });
  };

  const totalPaidMinutesThisWeek =
    workData?.sessions?.reduce((acc: number, s: any) => acc + (s.paidMinutes || 0), 0) || 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Real-Time Tracking</Text>
            <Text style={styles.headerTitle}>Track Work</Text>
          </View>
          <TouchableOpacity
            onPress={() => setManualModalVisible(true)}
            activeOpacity={0.8}
            style={styles.manualEntryButton}
          >
            <Plus size={15} color={colors.textPrimary} />
            <Text style={styles.manualEntryButtonText}>Add Manual</Text>
          </TouchableOpacity>
        </View>

        {/* 1. Main Work Status Hero Card */}
        <View style={[styles.heroCard, activeSession && styles.heroCardActive]}>
          <Text style={styles.statusLabel}>CURRENT STATUS</Text>
          <Text style={[styles.statusTitle, activeSession && styles.statusTitleActive]}>
            {activeSession ? 'SHIFT IN PROGRESS' : 'NOT WORKING'}
          </Text>

          {activeSession ? (
            <View style={styles.activeTimeContainer}>
              <Text style={styles.activeStartTimeLabel}>Started Timestamp</Text>
              <Text style={styles.activeStartTimeValue}>
                {formatTimeHHMM(activeSession.actualStart)}
              </Text>
              <Text style={styles.roundingNote}>
                Finish time automatically rounds up to next 5-min ceiling
              </Text>
            </View>
          ) : (
            <Text style={styles.idleHint}>
              Press below when you begin your shift to record exact start time.
            </Text>
          )}

          {/* Break Selection Switches */}
          <View style={styles.breakControlsSection}>
            <Text style={styles.breakSectionTitle}>SELECT SHIFT BREAKS</Text>
            <View style={styles.breakButtonsRow}>
              <TouchableOpacity
                onPress={() => setHasPaid15(!hasPaid15)}
                activeOpacity={0.8}
                style={[styles.breakButton, hasPaid15 && styles.breakButtonActive]}
              >
                <Coffee size={16} color={hasPaid15 ? colors.primary : colors.textTertiary} />
                <Text style={[styles.breakButtonText, hasPaid15 && styles.breakButtonTextActive]}>
                  15m Paid Coffee
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setHasUnpaid30(!hasUnpaid30)}
                activeOpacity={0.8}
                style={[styles.breakButton, hasUnpaid30 && styles.breakButtonActive]}
              >
                <Utensils size={16} color={hasUnpaid30 ? colors.amber : colors.textTertiary} />
                <Text
                  style={[styles.breakButtonText, hasUnpaid30 && styles.breakButtonTextActiveAmber]}
                >
                  30m Meal (Unpaid)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Big Action Button */}
          {activeSession ? (
            <TouchableOpacity
              onPress={() => finishMutation.mutate()}
              disabled={finishMutation.isPending}
              activeOpacity={0.85}
              style={styles.finishButton}
            >
              {finishMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={styles.buttonInnerRow}>
                  <Square size={18} color="#FFF" fill="#FFF" />
                  <Text style={styles.finishButtonText}>FINISH WORK (ROUND CEILING)</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              activeOpacity={0.85}
              style={styles.startButton}
            >
              {startMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <View style={styles.buttonInnerRow}>
                  <Play size={18} color={colors.textInverse} fill={colors.textInverse} />
                  <Text style={styles.startButtonText}>START WORK SHIFT</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 2. Work Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconRow}>
              <Clock size={16} color={colors.primary} />
              <Text style={styles.metricLabel}>Total Worked</Text>
            </View>
            <Text style={styles.metricValue}>{formatMinutes(totalPaidMinutesThisWeek)}</Text>
            <Text style={styles.metricSub}>This ISO week</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconRow}>
              <Coins size={16} color={colors.amber} />
              <Text style={styles.metricLabel}>Est. Earnings</Text>
            </View>
            <Text style={styles.metricValue}>
              {formatEUR((totalPaidMinutesThisWeek / 60) * 16.34)}
            </Text>
            <Text style={styles.metricSub}>Gross pay base</Text>
          </View>
        </View>

        {/* 3. Recent Work History */}
        <View style={styles.historySection}>
          <View style={styles.historyHeaderRow}>
            <History size={16} color={colors.textSecondary} />
            <Text style={styles.historySectionTitle}>RECENT COMPLETED SESSIONS</Text>
          </View>

          {pastSessions.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Text style={styles.emptyHistoryText}>No completed work sessions recorded yet.</Text>
            </View>
          ) : (
            pastSessions.slice(0, 5).map((session: any) => (
              <View key={session.id} style={styles.sessionCard}>
                <View style={styles.sessionCardHeader}>
                  <Text style={styles.sessionDate}>{formatDateShort(session.actualStart)}</Text>
                  <View style={styles.sessionPaidPill}>
                    <CheckCircle2 size={12} color={colors.primary} />
                    <Text style={styles.sessionPaidText}>
                      {formatMinutes(session.paidMinutes || 0)} Paid
                    </Text>
                  </View>
                </View>

                <View style={styles.sessionDetailsRow}>
                  <Text style={styles.sessionTimeSpan}>
                    {formatTimeHHMM(session.actualStart)} →{' '}
                    {session.roundedFinish ? formatTimeHHMM(session.roundedFinish) : '--:--'}
                  </Text>
                  <Text style={styles.sessionElapsed}>
                    Elapsed: {formatMinutes(session.elapsedMinutes || 0)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Manual Work Session Modal */}
      <Modal visible={manualModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Past Work Session</Text>
                <Text style={styles.modalSubtitle}>
                  Calculates 5-min ceiling rounding & payroll
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setManualModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>DATE (YYYY-MM-DD)</Text>
            <TextInput
              value={manualDateStr}
              onChangeText={setManualDateStr}
              placeholder="2026-08-24"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <View style={styles.timeInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>EXACT START (HH:MM)</Text>
                <TextInput
                  value={manualStartTime}
                  onChangeText={setManualStartTime}
                  placeholder="14:37"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.textInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>EXACT FINISH (HH:MM)</Text>
                <TextInput
                  value={manualFinishTime}
                  onChangeText={setManualFinishTime}
                  placeholder="23:21"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* Break Toggles */}
            <Text style={styles.inputLabel}>DEDUCTED BREAKS</Text>
            <View style={styles.breakButtonsRow}>
              <TouchableOpacity
                onPress={() => setManualPaid15(!manualPaid15)}
                style={[styles.breakButton, manualPaid15 && styles.breakButtonActive]}
              >
                <Coffee size={15} color={manualPaid15 ? colors.primary : colors.textTertiary} />
                <Text style={[styles.breakButtonText, manualPaid15 && styles.breakButtonTextActive]}>
                  15m Paid Break
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setManualUnpaid30(!manualUnpaid30)}
                style={[styles.breakButton, manualUnpaid30 && styles.breakButtonActive]}
              >
                <Utensils
                  size={15}
                  color={manualUnpaid30 ? colors.amber : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.breakButtonText,
                    manualUnpaid30 && styles.breakButtonTextActiveAmber,
                  ]}
                >
                  30m Meal (Unpaid)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>NOTES (OPTIONAL)</Text>
            <TextInput
              value={manualNotes}
              onChangeText={setManualNotes}
              placeholder="e.g. Forgot to clock out"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <TouchableOpacity
              onPress={handleSaveManualSession}
              disabled={manualWorkMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveManualButton}
            >
              {manualWorkMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveManualButtonText}>Save Manual Session</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 5,
  },
  manualEntryButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Hero Card
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 22,
    marginBottom: 18,
  },
  heroCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(6, 78, 59, 0.35)',
  },
  statusLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statusTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 8,
  },
  statusTitleActive: {
    color: colors.primaryLight,
  },
  activeTimeContainer: {
    marginVertical: 10,
  },
  activeStartTimeLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  activeStartTimeValue: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  roundingNote: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  idleHint: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginVertical: 8,
    lineHeight: 18,
  },

  // Break Controls
  breakControlsSection: {
    marginVertical: 14,
  },
  breakSectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  breakButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  breakButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  breakButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  breakButtonText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  breakButtonTextActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  breakButtonTextActiveAmber: {
    color: colors.amber,
    fontWeight: '700',
  },

  // Action Buttons
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  finishButton: {
    backgroundColor: colors.danger,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finishButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  metricSub: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },

  // History Section
  historySection: {
    marginTop: 4,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  historySectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  emptyHistoryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  sessionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 10,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sessionDate: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sessionPaidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  sessionPaidText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  sessionDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionTimeSpan: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  sessionElapsed: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '500',
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
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 14,
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveManualButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveManualButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
});
