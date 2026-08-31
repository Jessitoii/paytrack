import React, { useState, useMemo, useCallback } from 'react';
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
  Sliders,
  Check,
} from 'lucide-react-native';
import { workRepository } from '../../src/database';
import { useDatabaseRefresh } from '../../src/hooks/useDatabaseRefresh';
import { formatEUR, formatMinutes, formatTimeHHMM, formatDateShort } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

interface BreakItem {
  id: string;
  type: string;
  name: string;
  durationMinutes: number;
  isPaid: boolean;
  startTime?: string;
  endTime?: string;
}

export default function TrackWorkScreen() {
  const queryClient = useQueryClient();

  const { data: workSessions, isLoading, refetch: refetchWork } = useQuery({
    queryKey: ['localWorkSessions'],
    queryFn: () => workRepository.listWorkSessions(),
  });

  // DB Reactivity on database change + tab focus
  useDatabaseRefresh(['work_changed'], refetchWork);

  const activeSession = workSessions?.find((s: any) => s.status === 'WORKING');
  const pastSessions = workSessions?.filter((s: any) => s.status !== 'WORKING') || [];

  // Helper to format Date to HH:MM
  const getCurrentHHMM = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // 1. Finish Work Modal State
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [finishTimeInput, setFinishTimeInput] = useState('');
  const [finishBreaks, setFinishBreaks] = useState<BreakItem[]>([]);
  const [finishNotes, setFinishNotes] = useState('');

  // 2. Manual Work Modal State
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualDateStr, setManualDateStr] = useState(() => new Date().toISOString().substring(0, 10));
  const [manualStartTime, setManualStartTime] = useState('14:30');
  const [manualFinishTime, setManualFinishTime] = useState('23:00');
  const [manualBreaks, setManualBreaks] = useState<BreakItem[]>([]);
  const [manualNotes, setManualNotes] = useState('');

  // 3. Edit Past Session Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editDateStr, setEditDateStr] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editFinishTime, setEditFinishTime] = useState('');
  const [editBreaks, setEditBreaks] = useState<BreakItem[]>([]);
  const [editNotes, setEditNotes] = useState('');

  // 4. Custom Break Adder Modal State
  const [customBreakModalVisible, setCustomBreakModalVisible] = useState(false);
  const [customBreakTarget, setCustomBreakTarget] = useState<'FINISH' | 'MANUAL' | 'EDIT'>('FINISH');
  const [customBreakName, setCustomBreakName] = useState('Coffee Break');
  const [customBreakDuration, setCustomBreakDuration] = useState('15');
  const [customBreakIsPaid, setCustomBreakIsPaid] = useState(true);
  const [customBreakStart, setCustomBreakStart] = useState('');
  const [customBreakEnd, setCustomBreakEnd] = useState('');

  // Helper to add standard quick break
  const addQuickBreak = (
    target: 'FINISH' | 'MANUAL' | 'EDIT',
    type: string,
    name: string,
    durationMinutes: number,
    isPaid: boolean
  ) => {
    const item: BreakItem = {
      id: `brk_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      type,
      name,
      durationMinutes,
      isPaid,
    };

    if (target === 'FINISH') setFinishBreaks((prev) => [...prev, item]);
    else if (target === 'MANUAL') setManualBreaks((prev) => [...prev, item]);
    else if (target === 'EDIT') setEditBreaks((prev) => [...prev, item]);
  };

  const removeBreak = (target: 'FINISH' | 'MANUAL' | 'EDIT', id: string) => {
    if (target === 'FINISH') setFinishBreaks((prev) => prev.filter((b) => b.id !== id));
    else if (target === 'MANUAL') setManualBreaks((prev) => prev.filter((b) => b.id !== id));
    else if (target === 'EDIT') setEditBreaks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSaveCustomBreak = () => {
    const duration = parseInt(customBreakDuration, 10);
    if (isNaN(duration) || duration <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid duration in minutes.');
      return;
    }

    const item: BreakItem = {
      id: `brk_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      type: customBreakIsPaid ? 'CUSTOM_PAID' : 'CUSTOM_UNPAID',
      name: customBreakName.trim() || (customBreakIsPaid ? 'Custom Paid Break' : 'Custom Unpaid Break'),
      durationMinutes: duration,
      isPaid: customBreakIsPaid,
      startTime: customBreakStart.trim() || undefined,
      endTime: customBreakEnd.trim() || undefined,
    };

    if (customBreakTarget === 'FINISH') setFinishBreaks((prev) => [...prev, item]);
    else if (customBreakTarget === 'MANUAL') setManualBreaks((prev) => [...prev, item]);
    else if (customBreakTarget === 'EDIT') setEditBreaks((prev) => [...prev, item]);

    setCustomBreakModalVisible(false);
  };

  // Helper for live preview calculation
  const calculatePreview = (
    startTimeStr: string,
    finishTimeStr: string,
    breaks: BreakItem[]
  ) => {
    if (!startTimeStr || !finishTimeStr) return null;
    const [sh, sm] = startTimeStr.split(':').map(Number);
    const [fh, fm] = finishTimeStr.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(fh) || isNaN(fm)) return null;

    let startMins = sh * 60 + sm;
    let finishMins = fh * 60 + fm;
    if (finishMins < startMins) finishMins += 24 * 60; // overnight

    let rawElapsed = finishMins - startMins;
    let roundedFinishMins = Math.ceil(finishMins / 5) * 5;
    let roundedElapsed = roundedFinishMins - startMins;

    let paidBreakMins = 0;
    let unpaidBreakMins = 0;
    for (const b of breaks) {
      if (b.isPaid) paidBreakMins += b.durationMinutes;
      else unpaidBreakMins += b.durationMinutes;
    }

    const paidMins = Math.max(0, roundedElapsed - unpaidBreakMins);

    const roundedHH = String(Math.floor((roundedFinishMins % (24 * 60)) / 60)).padStart(2, '0');
    const roundedMM = String(roundedFinishMins % 60).padStart(2, '0');

    const estGross = (paidMins / 60) * 16.34;

    return {
      roundedFinishStr: `${roundedHH}:${roundedMM}`,
      rawElapsed,
      paidBreakMins,
      unpaidBreakMins,
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
    // Default breaks: 1x 15m Paid Coffee, 1x 30m Unpaid Meal
    setFinishBreaks([
      { id: 'b1', type: 'PAID_15', name: '15m Paid Coffee Break', durationMinutes: 15, isPaid: true },
      { id: 'b2', type: 'UNPAID_30', name: '30m Meal Break (Unpaid)', durationMinutes: 30, isPaid: false },
    ]);
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

    finishMutation.mutate({
      rawFinish,
      breaks: finishBreaks,
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

    // Populate existing breaks
    const existingBreaks: BreakItem[] = (session.breaks || []).map((b: any, idx: number) => ({
      id: b.id || `brk_${idx}`,
      type: b.type || (b.isPaid ? 'PAID_15' : 'UNPAID_30'),
      name: b.name || (b.isPaid ? 'Paid Break' : 'Unpaid Break'),
      durationMinutes: b.durationMinutes || (b.isPaid ? 15 : 30),
      isPaid: Boolean(b.isPaid),
      startTime: b.startTime,
      endTime: b.endTime,
    }));

    setEditBreaks(existingBreaks);
    setEditNotes(session.notes || '');
    setEditModalVisible(true);
  };

  const handleSaveEditSession = () => {
    if (!editingSessionId) return;
    const [sh, sm] = editStartTime.split(':').map(Number);
    const [fh, fm] = editFinishTime.split(':').map(Number);

    const [y, m, d] = editDateStr.split('-').map(Number);
    const actualStart = new Date(y, m - 1, d);
    actualStart.setHours(sh || 14, sm || 30, 0, 0);

    const rawFinish = new Date(y, m - 1, d);
    rawFinish.setHours(fh || 23, fm || 0, 0, 0);

    if (fh < sh) {
      rawFinish.setDate(rawFinish.getDate() + 1);
    }

    updateWorkMutation.mutate({
      id: editingSessionId,
      payload: {
        actualStart,
        rawFinish,
        breaks: editBreaks,
        notes: editNotes || undefined,
      },
    });
  };

  const handleSaveManualSession = () => {
    const [sh, sm] = manualStartTime.split(':').map(Number);
    const [eh, em] = manualFinishTime.split(':').map(Number);

    const [y, m, d] = manualDateStr.split('-').map(Number);
    const actualStart = new Date(y, m - 1, d);
    actualStart.setHours(sh || 14, sm || 30, 0, 0);

    const rawFinish = new Date(y, m - 1, d);
    rawFinish.setHours(eh || 23, em || 0, 0, 0);

    if (eh < sh) {
      rawFinish.setDate(rawFinish.getDate() + 1);
    }

    manualWorkMutation.mutate({
      actualStart,
      rawFinish,
      breaks: manualBreaks,
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
      finishBreaks
    );
  }, [activeSession, finishTimeInput, finishBreaks]);

  // Live edit preview
  const editPreview = useMemo(() => {
    return calculatePreview(editStartTime, editFinishTime, editBreaks);
  }, [editStartTime, editFinishTime, editBreaks]);

  // Live manual preview
  const manualPreview = useMemo(() => {
    return calculatePreview(manualStartTime, manualFinishTime, manualBreaks);
  }, [manualStartTime, manualFinishTime, manualBreaks]);

  // Subcomponent to render a break collection
  const renderBreakCollection = (target: 'FINISH' | 'MANUAL' | 'EDIT', breaks: BreakItem[]) => (
    <View style={styles.breakCollectionWrapper}>
      <View style={styles.breakCollectionHeader}>
        <Text style={styles.inputLabel}>BREAKS & MEAL PERIODS ({breaks.length})</Text>
      </View>

      {/* Quick Add Pills */}
      <View style={styles.quickAddPillsRow}>
        <TouchableOpacity
          onPress={() => addQuickBreak(target, 'PAID_15', '15m Paid Coffee', 15, true)}
          style={styles.quickAddPillEmerald}
        >
          <Coffee size={12} color={colors.primaryLight} />
          <Text style={styles.quickAddPillEmeraldText}>+ 15m Paid</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => addQuickBreak(target, 'UNPAID_15', '15m Unpaid Break', 15, false)}
          style={styles.quickAddPillAmber}
        >
          <Coffee size={12} color={colors.amber} />
          <Text style={styles.quickAddPillAmberText}>+ 15m Unpaid</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => addQuickBreak(target, 'UNPAID_30', '30m Meal (Unpaid)', 30, false)}
          style={styles.quickAddPillAmber}
        >
          <Utensils size={12} color={colors.amber} />
          <Text style={styles.quickAddPillAmberText}>+ 30m Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setCustomBreakTarget(target);
            setCustomBreakName('Coffee Break');
            setCustomBreakDuration('15');
            setCustomBreakIsPaid(true);
            setCustomBreakStart('');
            setCustomBreakEnd('');
            setCustomBreakModalVisible(true);
          }}
          style={styles.quickAddPillCustom}
        >
          <Sliders size={12} color={colors.textSecondary} />
          <Text style={styles.quickAddPillCustomText}>+ Custom</Text>
        </TouchableOpacity>
      </View>

      {/* Break List Cards */}
      {breaks.length === 0 ? (
        <View style={styles.noBreaksCard}>
          <Text style={styles.noBreaksText}>No breaks logged for this shift.</Text>
        </View>
      ) : (
        breaks.map((b) => (
          <View key={b.id} style={styles.breakCard}>
            <View style={styles.breakCardLeft}>
              <View
                style={[
                  styles.breakIconWrapper,
                  b.isPaid ? styles.breakIconPaid : styles.breakIconUnpaid,
                ]}
              >
                {b.durationMinutes >= 30 ? (
                  <Utensils size={14} color={b.isPaid ? colors.primaryLight : colors.amber} />
                ) : (
                  <Coffee size={14} color={b.isPaid ? colors.primaryLight : colors.amber} />
                )}
              </View>
              <View>
                <Text style={styles.breakNameText}>{b.name}</Text>
                <Text style={styles.breakTimeRangeText}>
                  {b.startTime && b.endTime
                    ? `${b.startTime} → ${b.endTime} • `
                    : ''}
                  {b.durationMinutes} min • {b.isPaid ? 'PAID' : 'UNPAID'}
                </Text>
              </View>
            </View>

            <View style={styles.breakCardRight}>
              <View
                style={[
                  styles.breakStatusBadge,
                  b.isPaid ? styles.badgePaid : styles.badgeUnpaid,
                ]}
              >
                <Text
                  style={[
                    styles.breakStatusBadgeText,
                    b.isPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid,
                  ]}
                >
                  {b.isPaid ? 'PAID' : '- ' + b.durationMinutes + 'm'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => removeBreak(target, b.id)}
                style={styles.breakDeleteButton}
              >
                <X size={14} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

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
            onPress={() => {
              setManualDateStr(new Date().toISOString().substring(0, 10));
              setManualStartTime('14:30');
              setManualFinishTime('23:00');
              setManualBreaks([
                { id: 'mb1', type: 'PAID_15', name: '15m Paid Coffee', durationMinutes: 15, isPaid: true },
                { id: 'mb2', type: 'UNPAID_30', name: '30m Meal (Unpaid)', durationMinutes: 30, isPaid: false },
              ]);
              setManualNotes('');
              setManualModalVisible(true);
            }}
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

                {session.breaks && session.breaks.length > 0 && (
                  <View style={styles.sessionBreaksSummaryRow}>
                    {session.breaks.map((b: any, bIdx: number) => (
                      <View
                        key={bIdx}
                        style={[
                          styles.sessionMiniBreakBadge,
                          b.isPaid ? styles.miniBreakPaid : styles.miniBreakUnpaid,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sessionMiniBreakText,
                            b.isPaid ? { color: colors.primaryLight } : { color: colors.amber },
                          ]}
                        >
                          {b.durationMinutes}m {b.isPaid ? 'Paid' : 'Unpaid'}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
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

            <ScrollView style={{ maxHeight: 420 }}>
              {/* Finish Time Override Input */}
              <View style={styles.timeInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>ACTUAL FINISH TIME (HH:MM)</Text>
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

              {/* Multi-Break Collection UI */}
              {renderBreakCollection('FINISH', finishBreaks)}

              {/* Live Calculation Preview Card */}
              {finishPreview && (
                <View style={styles.previewBox}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Raw Elapsed Time:</Text>
                    <Text style={styles.previewValue}>{formatMinutes(finishPreview.rawElapsed)}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>5-Min Rounded Finish:</Text>
                    <Text style={styles.previewValueHighlighted}>
                      {finishPreview.roundedFinishStr}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Paid Breaks (No deduction):</Text>
                    <Text style={[styles.previewValue, { color: colors.primaryLight }]}>
                      {finishPreview.paidBreakMins}m
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Unpaid Breaks (Deducted):</Text>
                    <Text style={[styles.previewValue, { color: colors.amber }]}>
                      -{finishPreview.unpaidBreakMins}m
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Net Paid Work Time:</Text>
                    <Text style={styles.previewValueEmerald}>
                      {formatMinutes(finishPreview.paidMins)}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Estimated Gross Base:</Text>
                    <Text style={styles.previewValueEmerald}>
                      {formatEUR(finishPreview.estGross)}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>SHIFT NOTES (OPTIONAL)</Text>
              <TextInput
                value={finishNotes}
                onChangeText={setFinishNotes}
                placeholder="Good shift, left right on time"
                placeholderTextColor={colors.textTertiary}
                style={styles.textInput}
              />
            </ScrollView>

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

            <ScrollView style={{ maxHeight: 420 }}>
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

              {/* Multi-Break Collection UI */}
              {renderBreakCollection('EDIT', editBreaks)}

              {/* Live Calculation Preview Card */}
              {editPreview && (
                <View style={styles.previewBox}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>5-Min Rounded Finish:</Text>
                    <Text style={styles.previewValueHighlighted}>
                      {editPreview.roundedFinishStr}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Net Paid Work Time:</Text>
                    <Text style={styles.previewValueEmerald}>
                      {formatMinutes(editPreview.paidMins)}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Estimated Gross Base:</Text>
                    <Text style={styles.previewValueEmerald}>
                      {formatEUR(editPreview.estGross)}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>NOTES (OPTIONAL)</Text>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Corrected shift time"
                placeholderTextColor={colors.textTertiary}
                style={styles.textInput}
              />
            </ScrollView>

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

            <ScrollView style={{ maxHeight: 420 }}>
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

              {/* Multi-Break Collection UI */}
              {renderBreakCollection('MANUAL', manualBreaks)}

              {/* Live Calculation Preview Card */}
              {manualPreview && (
                <View style={styles.previewBox}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>5-Min Rounded Finish:</Text>
                    <Text style={styles.previewValueHighlighted}>
                      {manualPreview.roundedFinishStr}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Net Paid Work Time:</Text>
                    <Text style={styles.previewValueEmerald}>
                      {formatMinutes(manualPreview.paidMins)}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Estimated Gross Base:</Text>
                    <Text style={styles.previewValueEmerald}>
                      {formatEUR(manualPreview.estGross)}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>NOTES (OPTIONAL)</Text>
              <TextInput
                value={manualNotes}
                onChangeText={setManualNotes}
                placeholder="Past shift entry"
                placeholderTextColor={colors.textTertiary}
                style={styles.textInput}
              />
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveManualSession}
              disabled={manualWorkMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveManualButton}
            >
              {manualWorkMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveManualButtonText}>Record Work Session</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 4. Custom Break Modal */}
      <Modal visible={customBreakModalVisible} animationType="fade" transparent>
        <View style={styles.customModalOverlay}>
          <View style={styles.customBreakCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Break</Text>
              <TouchableOpacity
                onPress={() => setCustomBreakModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>BREAK NAME / DESCRIPTION</Text>
            <TextInput
              value={customBreakName}
              onChangeText={setCustomBreakName}
              placeholder="Coffee Break, Smoke Break, etc."
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <View style={styles.timeInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>START TIME (OPTIONAL)</Text>
                <TextInput
                  value={customBreakStart}
                  onChangeText={setCustomBreakStart}
                  placeholder="18:00"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.textInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>END TIME (OPTIONAL)</Text>
                <TextInput
                  value={customBreakEnd}
                  onChangeText={setCustomBreakEnd}
                  placeholder="18:15"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.textInput}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>DURATION (MINUTES)</Text>
            <TextInput
              value={customBreakDuration}
              onChangeText={setCustomBreakDuration}
              placeholder="15"
              keyboardType="numeric"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>PAYMENT STATUS</Text>
            <View style={styles.paidToggleRow}>
              <TouchableOpacity
                onPress={() => setCustomBreakIsPaid(true)}
                style={[styles.paidToggleBtn, customBreakIsPaid && styles.paidToggleBtnActivePaid]}
              >
                <Coffee size={15} color={customBreakIsPaid ? colors.primaryLight : colors.textTertiary} />
                <Text style={[styles.paidToggleText, customBreakIsPaid && styles.paidToggleTextActivePaid]}>
                  PAID (Company pays)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCustomBreakIsPaid(false)}
                style={[styles.paidToggleBtn, !customBreakIsPaid && styles.paidToggleBtnActiveUnpaid]}
              >
                <Utensils size={15} color={!customBreakIsPaid ? colors.amber : colors.textTertiary} />
                <Text style={[styles.paidToggleText, !customBreakIsPaid && styles.paidToggleTextActiveUnpaid]}>
                  UNPAID (Deducted)
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleSaveCustomBreak}
              activeOpacity={0.85}
              style={styles.saveCustomBreakBtn}
            >
              <Text style={styles.saveCustomBreakBtnText}>Add Break to List</Text>
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
    gap: 6,
  },
  manualEntryButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Main Work Hero Card
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 22,
    marginBottom: 20,
  },
  heroCardActive: {
    backgroundColor: 'rgba(6, 78, 59, 0.4)',
    borderColor: colors.primary,
  },
  statusLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginVertical: 4,
  },
  statusTitleActive: {
    color: colors.primaryLight,
  },
  activeTimeContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
  },
  activeStartTimeLabel: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  activeStartTimeValue: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  roundingNote: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  idleHint: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginVertical: 12,
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  finishButton: {
    backgroundColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
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
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
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
    fontSize: 20,
    fontWeight: '800',
  },
  metricSub: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // History Section
  historySection: {
    marginTop: 4,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  historySectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
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
    padding: 14,
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
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
    alignItems: 'center',
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
  sessionBreaksSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  sessionMiniBreakBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniBreakPaid: {
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  miniBreakUnpaid: {
    backgroundColor: colors.amberBg,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  sessionMiniBreakText: {
    fontSize: 9.5,
    fontWeight: '700',
  },

  // Modal Common
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
    color: colors.textPrimary,
    fontSize: 19,
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
    marginBottom: 12,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 6,
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  useCurrentTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    gap: 5,
    marginBottom: 12,
  },
  useCurrentTimeText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },

  // Multi-Break Collection
  breakCollectionWrapper: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 14,
  },
  breakCollectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickAddPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  quickAddPillEmerald: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  quickAddPillEmeraldText: {
    color: colors.primaryLight,
    fontSize: 10.5,
    fontWeight: '700',
  },
  quickAddPillAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amberBg,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  quickAddPillAmberText: {
    color: colors.amber,
    fontSize: 10.5,
    fontWeight: '700',
  },
  quickAddPillCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  quickAddPillCustomText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '700',
  },
  noBreaksCard: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  noBreaksText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  breakCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
  },
  breakCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  breakIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakIconPaid: {
    backgroundColor: colors.primaryBg,
  },
  breakIconUnpaid: {
    backgroundColor: colors.amberBg,
  },
  breakNameText: {
    color: colors.textPrimary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  breakTimeRangeText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  breakCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgePaid: {
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  badgeUnpaid: {
    backgroundColor: colors.amberBg,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  breakStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextPaid: {
    color: colors.primaryLight,
  },
  badgeTextUnpaid: {
    color: colors.amber,
  },
  breakDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Live Preview Box
  previewBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginVertical: 10,
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
    color: colors.blue,
    fontSize: 14,
    fontWeight: '900',
  },
  previewValueEmerald: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: '900',
  },

  confirmFinishButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  confirmFinishButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
  saveManualButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveManualButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  deleteButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Custom Break Modal Overlay
  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  customBreakCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  paidToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  paidToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  paidToggleBtnActivePaid: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  paidToggleBtnActiveUnpaid: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amber,
  },
  paidToggleText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
  },
  paidToggleTextActivePaid: {
    color: colors.primaryLight,
  },
  paidToggleTextActiveUnpaid: {
    color: colors.amber,
  },
  saveCustomBreakBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCustomBreakBtnText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '800',
  },
});
