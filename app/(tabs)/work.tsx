import React, { useState, useMemo } from 'react';
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
  Trash2,
  Edit3,
} from 'lucide-react-native';
import { workRepository } from '../../src/database';
import { formatEUR, formatMinutes, formatTimeHHMM, formatDateShort } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

export default function TrackWorkScreen() {
  const queryClient = useQueryClient();

  // 1. Finish Work Modal States
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [finishTimeInput, setFinishTimeInput] = useState('');
  const [finishPaid15, setFinishPaid15] = useState(true);
  const [finishUnpaid30, setFinishUnpaid30] = useState(true);
  const [finishNotes, setFinishNotes] = useState('');

  // 2. Manual Work Modal States
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualDateStr, setManualDateStr] = useState(new Date().toISOString().substring(0, 10));
  const [manualStartTime, setManualStartTime] = useState('14:30');
  const [manualFinishTime, setManualFinishTime] = useState('23:00');
  const [manualPaid15, setManualPaid15] = useState(true);
  const [manualUnpaid30, setManualUnpaid30] = useState(true);
  const [manualNotes, setManualNotes] = useState('');

  // 3. Edit Session Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editDateStr, setEditDateStr] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editFinishTime, setEditFinishTime] = useState('');
  const [editPaid15, setEditPaid15] = useState(true);
  const [editUnpaid30, setEditUnpaid30] = useState(true);
  const [editNotes, setEditNotes] = useState('');

  const { data: workSessions, isLoading } = useQuery({
    queryKey: ['localWorkSessions'],
    queryFn: () => workRepository.listWorkSessions(),
  });

  const activeSession = workSessions?.find((s: any) => s.status === 'WORKING');
  const pastSessions = workSessions?.filter((s: any) => s.status !== 'WORKING') || [];

  // Helper to format Date to HH:MM
  const getCurrentHHMM = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Helper for 5-min ceiling preview calculation
  const calculatePreview = (startTimeStr: string, finishTimeStr: string, paid15: boolean, unpaid30: boolean) => {
    if (!startTimeStr || !finishTimeStr) return null;
    const [sh, sm] = startTimeStr.split(':').map(Number);
    const [fh, fm] = finishTimeStr.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(fh) || isNaN(fm)) return null;

    let startMins = sh * 60 + sm;
    let finishMins = fh * 60 + fm;
    if (finishMins < startMins) finishMins += 24 * 60; // overnight

    let elapsed = finishMins - startMins;
    let roundedFinishMins = Math.ceil(finishMins / 5) * 5;
    let roundedElapsed = roundedFinishMins - startMins;

    const unpaidDeduction = unpaid30 ? 30 : 0;
    const paidMins = Math.max(0, roundedElapsed - unpaidDeduction);

    const roundedHH = String(Math.floor((roundedFinishMins % (24 * 60)) / 60)).padStart(2, '0');
    const roundedMM = String(roundedFinishMins % 60).padStart(2, '0');

    const estGross = (paidMins / 60) * 16.34;

    return {
      roundedFinishStr: `${roundedHH}:${roundedMM}`,
      elapsedMins: elapsed,
      paidMins,
      estGross,
    };
  };

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => workRepository.startWork(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localWorkSessions'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const finishMutation = useMutation({
    mutationFn: (payload: { rawFinish: Date; breaks: any[]; notes?: string }) => {
      if (!activeSession) throw new Error('No active session found');
      return workRepository.finishWork(activeSession.id, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['localWorkSessions'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      setFinishModalVisible(false);
      Alert.alert(
        'Shift Finished Successfully',
        `Rounded Finish: ${formatTimeHHMM(data.session.roundedFinish)}\nPaid Time: ${formatMinutes(data.calculation.paidMinutes)}\nEst. Gross: ${formatEUR((data.calculation.paidMinutes / 60) * 16.34)}`
      );
    },
    onError: (err: any) => Alert.alert('Finish Error', err.message),
  });

  const manualWorkMutation = useMutation({
    mutationFn: (payload: any) => workRepository.createManualWork(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['localWorkSessions'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      setManualModalVisible(false);
      Alert.alert(
        'Manual Session Saved',
        `Recorded ${formatMinutes(data.calculation.paidMinutes)} paid time.\n5-Min Rounding Ceiling: ${formatTimeHHMM(data.session.roundedFinish)}`
      );
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const updateWorkMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      workRepository.updateWork(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localWorkSessions'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      setEditModalVisible(false);
      Alert.alert('Session Updated', 'Work session recalculated and saved locally.');
    },
    onError: (err: any) => Alert.alert('Update Error', err.message),
  });

  const deleteWorkMutation = useMutation({
    mutationFn: (id: string) => workRepository.deleteWork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localWorkSessions'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      setEditModalVisible(false);
      Alert.alert('Session Deleted', 'Work session removed.');
    },
    onError: (err: any) => Alert.alert('Delete Error', err.message),
  });

  // Open Finish Modal
  const handleOpenFinishModal = () => {
    setFinishTimeInput(getCurrentHHMM());
    setFinishPaid15(true);
    setFinishUnpaid30(true);
    setFinishNotes('');
    setFinishModalVisible(true);
  };

  const handleConfirmFinish = () => {
    if (!activeSession) return;
    const [fh, fm] = finishTimeInput.split(':').map(Number);
    if (isNaN(fh) || isNaN(fm)) {
      Alert.alert('Validation Error', 'Please enter a valid finish time (HH:MM)');
      return;
    }

    const startDate = new Date(activeSession.actualStart);
    const rawFinish = new Date(startDate);
    rawFinish.setHours(fh, fm, 0, 0);

    if (fh < startDate.getHours()) {
      rawFinish.setDate(rawFinish.getDate() + 1);
    }

    const breaks = [];
    if (finishPaid15) {
      breaks.push({ type: 'PAID_15', durationMinutes: 15, isPaid: true, name: '15m Paid Coffee Break' });
    }
    if (finishUnpaid30) {
      breaks.push({ type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: '30m Meal Break (Unpaid)' });
    }

    finishMutation.mutate({
      rawFinish,
      breaks,
      notes: finishNotes || undefined,
    });
  };

  // Open Edit Modal for past session
  const handleOpenEditModal = (session: any) => {
    setEditingSessionId(session.id);
    const sDate = new Date(session.actualStart);
    setEditDateStr(sDate.toISOString().substring(0, 10));
    setEditStartTime(formatTimeHHMM(session.actualStart));
    setEditFinishTime(session.rawFinish ? formatTimeHHMM(session.rawFinish) : '23:00');

    const hasP15 = session.breaks?.some((b: any) => b.isPaid) ?? true;
    const hasU30 = session.breaks?.some((b: any) => !b.isPaid) ?? true;
    setEditPaid15(hasP15);
    setEditUnpaid30(hasU30);
    setEditNotes(session.notes || '');

    setEditModalVisible(true);
  };

  const handleSaveEditSession = () => {
    if (!editingSessionId) return;
    const [sh, sm] = editStartTime.split(':').map(Number);
    const [fh, fm] = editFinishTime.split(':').map(Number);

    const baseDate = new Date(editDateStr);
    const actualStart = new Date(baseDate);
    actualStart.setHours(sh || 14, sm || 30, 0, 0);

    const rawFinish = new Date(baseDate);
    rawFinish.setHours(fh || 23, fm || 0, 0, 0);

    if (fh < sh) {
      rawFinish.setDate(rawFinish.getDate() + 1);
    }

    const breaks = [];
    if (editPaid15) {
      breaks.push({ type: 'PAID_15', durationMinutes: 15, isPaid: true, name: '15m Paid Coffee Break' });
    }
    if (editUnpaid30) {
      breaks.push({ type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: '30m Meal Break (Unpaid)' });
    }

    updateWorkMutation.mutate({
      id: editingSessionId,
      payload: {
        actualStart,
        rawFinish,
        breaks,
        notes: editNotes || undefined,
      },
    });
  };

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
      breaks.push({ type: 'PAID_15', durationMinutes: 15, isPaid: true, name: '15m Paid Coffee Break' });
    }
    if (manualUnpaid30) {
      breaks.push({ type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: '30m Meal Break (Unpaid)' });
    }

    manualWorkMutation.mutate({
      actualStart,
      rawFinish,
      breaks,
      notes: manualNotes || undefined,
    });
  };

  // Compute Current Week Paid Minutes accurately
  const now = new Date();
  const currentDay = now.getDay() || 7;
  const currentMon = new Date(now);
  currentMon.setDate(now.getDate() - currentDay + 1);
  currentMon.setHours(0, 0, 0, 0);
  const currentSun = new Date(currentMon);
  currentSun.setDate(currentMon.getDate() + 6);
  currentSun.setHours(23, 59, 59, 999);

  const totalPaidMinutesThisWeek =
    workSessions?.reduce((acc: number, s: any) => {
      if (s.status !== 'COMPLETED' && s.status !== 'EDITED') return acc;
      const sDate = new Date(s.actualStart);
      if (sDate >= currentMon && sDate <= currentSun) {
        return acc + (s.paidMinutes || 0);
      }
      return acc;
    }, 0) || 0;

  // Live finish preview
  const finishPreview = useMemo(() => {
    if (!activeSession) return null;
    return calculatePreview(
      formatTimeHHMM(activeSession.actualStart),
      finishTimeInput,
      finishPaid15,
      finishUnpaid30
    );
  }, [activeSession, finishTimeInput, finishPaid15, finishUnpaid30]);

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

          {/* Big Action Button */}
          {activeSession ? (
            <TouchableOpacity
              onPress={handleOpenFinishModal}
              activeOpacity={0.85}
              style={styles.finishButton}
            >
              <View style={styles.buttonInnerRow}>
                <Square size={18} color="#FFF" fill="#FFF" />
                <Text style={styles.finishButtonText}>FINISH WORK (CONFIRM)</Text>
              </View>
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

        {/* 3. Recent Work History (Clickable to Edit) */}
        <View style={styles.historySection}>
          <View style={styles.historyHeaderRow}>
            <History size={16} color={colors.textSecondary} />
            <Text style={styles.historySectionTitle}>WORK HISTORY (TAP TO EDIT)</Text>
          </View>

          {pastSessions.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Text style={styles.emptyHistoryText}>No completed work sessions recorded yet.</Text>
            </View>
          ) : (
            pastSessions.map((session: any) => (
              <TouchableOpacity
                key={session.id}
                onPress={() => handleOpenEditModal(session)}
                activeOpacity={0.75}
                style={styles.sessionCard}
              >
                <View style={styles.sessionCardHeader}>
                  <Text style={styles.sessionDate}>{formatDateShort(session.actualStart)}</Text>
                  <View style={styles.sessionCardHeaderRight}>
                    <View style={styles.sessionPaidPill}>
                      <CheckCircle2 size={12} color={colors.primary} />
                      <Text style={styles.sessionPaidText}>
                        {formatMinutes(session.paidMinutes || 0)} Paid
                      </Text>
                    </View>
                    <Edit3 size={14} color={colors.textTertiary} style={{ marginLeft: 6 }} />
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
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* 1. Finish Work Confirmation Modal */}
      <Modal visible={finishModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Finish Today's Shift</Text>
                <Text style={styles.modalSubtitle}>
                  Started at {activeSession ? formatTimeHHMM(activeSession.actualStart) : '--:--'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setFinishModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Finish Time Override Input */}
            <View style={styles.timeInputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>FINISH TIME (HH:MM)</Text>
                <TextInput
                  value={finishTimeInput}
                  onChangeText={setFinishTimeInput}
                  placeholder="23:17"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.textInput}
                />
              </View>
              <TouchableOpacity
                onPress={() => setFinishTimeInput(getCurrentHHMM())}
                style={styles.useCurrentTimeButton}
              >
                <Clock size={14} color={colors.primaryLight} />
                <Text style={styles.useCurrentTimeText}>Use Current</Text>
              </TouchableOpacity>
            </View>

            {/* Break Selection on Finish */}
            <Text style={styles.inputLabel}>SELECT SHIFT BREAKS</Text>
            <View style={styles.breakButtonsRow}>
              <TouchableOpacity
                onPress={() => setFinishPaid15(!finishPaid15)}
                style={[styles.breakButton, finishPaid15 && styles.breakButtonActive]}
              >
                <Coffee size={15} color={finishPaid15 ? colors.primary : colors.textTertiary} />
                <Text style={[styles.breakButtonText, finishPaid15 && styles.breakButtonTextActive]}>
                  15m Paid Coffee
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFinishUnpaid30(!finishUnpaid30)}
                style={[styles.breakButton, finishUnpaid30 && styles.breakButtonActive]}
              >
                <Utensils
                  size={15}
                  color={finishUnpaid30 ? colors.amber : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.breakButtonText,
                    finishUnpaid30 && styles.breakButtonTextActiveAmber,
                  ]}
                >
                  30m Meal (Unpaid)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Live Calculation Preview Card */}
            {finishPreview && (
              <View style={styles.previewBox}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>5-Min Rounded Finish:</Text>
                  <Text style={styles.previewValueHighlighted}>
                    {finishPreview.roundedFinishStr}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Net Paid Time:</Text>
                  <Text style={styles.previewValue}>{formatMinutes(finishPreview.paidMins)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Estimated Gross Base:</Text>
                  <Text style={styles.previewValueEmerald}>
                    {formatEUR(finishPreview.estGross)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleConfirmFinish}
              disabled={finishMutation.isPending}
              activeOpacity={0.85}
              style={styles.confirmFinishButton}
            >
              {finishMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.confirmFinishButtonText}>Confirm & Finish Shift</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. Edit Completed Session Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Work Session</Text>
                <Text style={styles.modalSubtitle}>Recalculates payroll deterministically</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>DATE (YYYY-MM-DD)</Text>
            <TextInput
              value={editDateStr}
              onChangeText={setEditDateStr}
              placeholder="2026-08-24"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <View style={styles.timeInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>START TIME (HH:MM)</Text>
                <TextInput
                  value={editStartTime}
                  onChangeText={setEditStartTime}
                  placeholder="14:37"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.textInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>FINISH TIME (HH:MM)</Text>
                <TextInput
                  value={editFinishTime}
                  onChangeText={setEditFinishTime}
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
                onPress={() => setEditPaid15(!editPaid15)}
                style={[styles.breakButton, editPaid15 && styles.breakButtonActive]}
              >
                <Coffee size={15} color={editPaid15 ? colors.primary : colors.textTertiary} />
                <Text style={[styles.breakButtonText, editPaid15 && styles.breakButtonTextActive]}>
                  15m Paid Break
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditUnpaid30(!editUnpaid30)}
                style={[styles.breakButton, editUnpaid30 && styles.breakButtonActive]}
              >
                <Utensils
                  size={15}
                  color={editUnpaid30 ? colors.amber : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.breakButtonText,
                    editUnpaid30 && styles.breakButtonTextActiveAmber,
                  ]}
                >
                  30m Meal (Unpaid)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>NOTES (OPTIONAL)</Text>
            <TextInput
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Corrected shift time"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <View style={styles.editActionsRow}>
              <TouchableOpacity
                onPress={() => {
                  if (editingSessionId) {
                    Alert.alert('Delete Session', 'Are you sure you want to remove this work session?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteWorkMutation.mutate(editingSessionId) },
                    ]);
                  }
                }}
                disabled={deleteWorkMutation.isPending}
                style={styles.deleteButton}
              >
                <Trash2 size={18} color={colors.danger} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveEditSession}
                disabled={updateWorkMutation.isPending}
                activeOpacity={0.85}
                style={[styles.saveManualButton, { flex: 1, marginTop: 0 }]}
              >
                {updateWorkMutation.isPending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.saveManualButtonText}>Save & Recalculate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. Add Manual Work Session Modal */}
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
  sessionCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 6,
  },
  useCurrentTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14,
    gap: 5,
  },
  useCurrentTimeText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },
  breakButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
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
  previewBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 14,
    gap: 6,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  previewValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  previewValueHighlighted: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: '800',
  },
  previewValueEmerald: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: '800',
  },
  confirmFinishButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  confirmFinishButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  deleteButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
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
