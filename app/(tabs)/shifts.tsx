import React, { useState, useCallback, useMemo } from 'react';
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
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  X,
  Copy,
  Sliders,
  Edit3,
  Calendar as CalendarIcon,
  Sun,
  Sunset,
  Moon,
  Coffee,
  CheckCircle2,
  CalendarRange,
} from 'lucide-react-native';
import { shiftRepository } from '../../src/database';
import { useDatabaseRefresh } from '../../src/hooks/useDatabaseRefresh';
import { formatDateShort, formatTimeHHMM } from '../../src/lib/formatters';
import { getCalendarMonthGrid, getMonthYearTitle } from '../../src/lib/calendar';
import { ColorPalette } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeContext';
import { useNotification } from '../../src/components/NotificationContext';

const getShiftPresets = (colors: ColorPalette) => [
  { label: 'Morning', type: 'MORNING', start: '06:00', end: '14:30', isOff: false, icon: Sun, color: colors.amber },
  { label: 'Afternoon', type: 'AFTERNOON', start: '14:30', end: '23:00', isOff: false, icon: Sunset, color: colors.indigo },
  { label: 'Night', type: 'NIGHT', start: '22:30', end: '06:00', isOff: false, icon: Moon, color: colors.purple },
  { label: 'OFF', type: 'OFF', start: '', end: '', isOff: true, icon: Coffee, color: colors.textTertiary },
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ShiftsScreen() {
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const shiftPresets = useMemo(() => getShiftPresets(colors), [colors]);
  const { showSuccess, showError, confirm } = useNotification();

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().substring(0, 10));

  // Modals
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);

  // Day Edit State
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [editType, setEditType] = useState('AFTERNOON');
  const [editStart, setEditStart] = useState('14:30');
  const [editEnd, setEditEnd] = useState('23:00');
  const [editIsOff, setEditIsOff] = useState(false);
  const [editAdjMinutes, setEditAdjMinutes] = useState(0);
  const [customAdjInput, setCustomAdjInput] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Bulk Week State (Monday to Sunday)
  const [bulkWeekStart, setBulkWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [bulkShifts, setBulkShifts] = useState<Array<{ type: string; isOff: boolean; adjMinutes: number }>>([
    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 }, // Mon
    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 }, // Tue
    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 }, // Wed
    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 }, // Thu
    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 }, // Fri
    { type: 'OFF', isOff: true, adjMinutes: 0 },        // Sat
    { type: 'OFF', isOff: true, adjMinutes: 0 },        // Sun
  ]);

  // Query shifts for current month window
  const queryStartDate = `${currentYear}-${String(currentMonthIndex === 0 ? 12 : currentMonthIndex).padStart(2, '0')}-01`;
  const queryEndDate = `${currentYear}-${String(currentMonthIndex === 11 ? 1 : currentMonthIndex + 2).padStart(2, '0')}-28`;

  const { data: shifts, refetch: refetchShifts } = useQuery({
    queryKey: ['localShifts', currentYear, currentMonthIndex],
    queryFn: () =>
      shiftRepository.listShifts({
        startDate: queryStartDate,
        endDate: queryEndDate,
      }),
  });

  // DB Reactivity on database change + tab focus
  useDatabaseRefresh(['shifts_changed'], refetchShifts);

  // Mutations
  const saveShiftMutation = useMutation({
    mutationFn: (payload: any) => shiftRepository.saveShift(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localShifts'] });
      setDayModalVisible(false);
      showSuccess('Shift Saved', 'Shift schedule updated.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => shiftRepository.deleteShift(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localShifts'] });
      setDayModalVisible(false);
      showSuccess('Shift Removed', 'Shift removed from calendar.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const bulkSaveMutation = useMutation({
    mutationFn: (payload: any) => shiftRepository.bulkSaveWeek(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localShifts'] });
      setBulkModalVisible(false);
      showSuccess('Week Configured', '7-day shift roster saved atomically.');
    },
    onError: (err: any) => showError('Bulk Save Error', err.message),
  });

  const copyPreviousWeekMutation = useMutation({
    mutationFn: (targetWeekStartDate: string) =>
      shiftRepository.copyPreviousWeek({ targetWeekStartDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localShifts'] });
      setBulkModalVisible(false);
      showSuccess('Copied Successfully', 'Copied previous week roster.');
    },
    onError: (err: any) => showError('Copy Error', err.message),
  });

  // Month navigation (handles December -> January year rollover seamlessly)
  const prevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonthIndex(11);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonthIndex(0);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  const todayStr = new Date().toISOString().substring(0, 10);
  const monthName = getMonthYearTitle(currentYear, currentMonthIndex);
  const calendarCells = getCalendarMonthGrid(currentYear, currentMonthIndex, todayStr);

  // Open Day Edit Modal
  const handleSelectDay = (dateStr: string) => {
    setSelectedDate(dateStr);
    const existing = shifts?.find((s: any) => s.date.substring(0, 10) === dateStr);

    if (existing) {
      setEditShiftId(existing.id);
      setEditType(existing.shiftType);
      setEditIsOff(Boolean(existing.isDayOff));
      setEditStart(existing.plannedStart ? formatTimeHHMM(existing.plannedStart) : '14:30');
      setEditEnd(existing.plannedEnd ? formatTimeHHMM(existing.plannedEnd) : '23:00');
      const adj = existing.startAdjustmentMinutes || 0;
      setEditAdjMinutes(adj);
      setCustomAdjInput(adj > 0 && adj !== 15 && adj !== 30 ? String(adj) : '');
      setEditNotes(existing.notes || '');
    } else {
      setEditShiftId(null);
      setEditType('AFTERNOON');
      setEditIsOff(false);
      setEditStart('14:30');
      setEditEnd('23:00');
      setEditAdjMinutes(0);
      setCustomAdjInput('');
      setEditNotes('');
    }

    setDayModalVisible(true);
  };

  // Compute Expected Actual Start Time
  const computeExpectedStart = (startStr: string, adjMins: number) => {
    const [sh, sm] = startStr.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm)) return startStr;
    const totalMins = sh * 60 + sm + adjMins;
    const hh = String(Math.floor((totalMins % (24 * 60)) / 60)).padStart(2, '0');
    const mm = String(totalMins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Save Day Shift
  const handleSaveDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const baseDate = new Date(y, m - 1, d);

    let plannedStart: Date | null = null;
    let plannedEnd: Date | null = null;
    let expectedActualStart: Date | null = null;

    if (!editIsOff && editType !== 'OFF') {
      const [sh, sm] = editStart.split(':').map(Number);
      const [eh, em] = editEnd.split(':').map(Number);

      plannedStart = new Date(baseDate);
      plannedStart.setHours(sh || 14, sm || 30, 0, 0);

      plannedEnd = new Date(baseDate);
      plannedEnd.setHours(eh || 23, em || 0, 0, 0);

      if (eh < sh) {
        plannedEnd.setDate(plannedEnd.getDate() + 1);
      }

      if (editAdjMinutes > 0) {
        expectedActualStart = new Date(plannedStart);
        expectedActualStart.setMinutes(expectedActualStart.getMinutes() + editAdjMinutes);
      } else {
        expectedActualStart = plannedStart;
      }
    }

    saveShiftMutation.mutate({
      id: editShiftId || undefined,
      date: selectedDate,
      shiftType: editType,
      plannedStart,
      plannedEnd,
      startAdjustmentMinutes: editAdjMinutes,
      expectedActualStart,
      isDayOff: editIsOff || editType === 'OFF',
      notes: editNotes || undefined,
    });
  };

  // Save Bulk Week
  const handleSaveBulkWeek = () => {
    const [y, m, d] = bulkWeekStart.split('-').map(Number);
    const monday = new Date(y, m - 1, d);

    const weekShiftsPayload = bulkShifts.map((item, idx) => {
      const shiftDate = new Date(monday);
      shiftDate.setDate(monday.getDate() + idx);
      const dateStr = `${shiftDate.getFullYear()}-${String(shiftDate.getMonth() + 1).padStart(2, '0')}-${String(shiftDate.getDate()).padStart(2, '0')}`;

      let plannedStart: Date | null = null;
      let plannedEnd: Date | null = null;
      let expectedActualStart: Date | null = null;

      if (!item.isOff && item.type !== 'OFF') {
        const preset = shiftPresets.find((p) => p.type === item.type) || shiftPresets[1];
        const [sh, sm] = preset.start.split(':').map(Number);
        const [eh, em] = preset.end.split(':').map(Number);

        plannedStart = new Date(shiftDate);
        plannedStart.setHours(sh, sm, 0, 0);

        plannedEnd = new Date(shiftDate);
        plannedEnd.setHours(eh, em, 0, 0);
        if (eh < sh) plannedEnd.setDate(plannedEnd.getDate() + 1);

        if (item.adjMinutes > 0) {
          expectedActualStart = new Date(plannedStart);
          expectedActualStart.setMinutes(expectedActualStart.getMinutes() + item.adjMinutes);
        } else {
          expectedActualStart = plannedStart;
        }
      }

      return {
        date: dateStr,
        shiftType: item.type,
        plannedStart,
        plannedEnd,
        startAdjustmentMinutes: item.adjMinutes,
        expectedActualStart,
        isDayOff: item.isOff || item.type === 'OFF',
      };
    });

    bulkSaveMutation.mutate({
      weekStartDate: bulkWeekStart,
      shifts: weekShiftsPayload,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Albert Heijn Bleiswijk</Text>
            <Text style={styles.headerTitle}>Shift Roster</Text>
          </View>

          <TouchableOpacity
            onPress={() => setBulkModalVisible(true)}
            activeOpacity={0.8}
            style={styles.bulkButton}
          >
            <Sliders size={15} color={colors.primaryLight} />
            <Text style={styles.bulkButtonText}>Set Week</Text>
          </TouchableOpacity>
        </View>

        {/* Month Navigation Card */}
        <View style={styles.monthNavCard}>
          <TouchableOpacity onPress={prevMonth} style={styles.navArrowButton}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthTitleText}>{monthName}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navArrowButton}>
            <ChevronRight size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 7-Column Calendar Grid */}
        <View style={styles.calendarContainer}>
          {/* Day Names Header (Mon -> Sun) */}
          <View style={styles.dayNamesRow}>
            {DAYS_OF_WEEK.map((dayName, idx) => (
              <View key={dayName} style={styles.dayNameCell}>
                <Text
                  style={[
                    styles.dayNameText,
                    (idx === 5 || idx === 6) && { color: colors.textTertiary },
                  ]}
                >
                  {dayName}
                </Text>
              </View>
            ))}
          </View>

          {/* Grid Cells */}
          <View style={styles.gridCellsContainer}>
            {calendarCells.map((cell) => {
              const shift = shifts?.find((s: any) => s.date.substring(0, 10) === cell.dateStr);

              let pillBg = colors.cardElevated;
              let pillText = colors.textTertiary;

              if (shift) {
                if (shift.isDayOff || shift.shiftType === 'OFF') {
                  pillBg = colors.backgroundSecondary;
                  pillText = colors.textTertiary;
                } else if (shift.shiftType === 'MORNING') {
                  pillBg = colors.amberBg;
                  pillText = colors.amber;
                } else if (shift.shiftType === 'AFTERNOON') {
                  pillBg = colors.indigoBg;
                  pillText = colors.indigo;
                } else if (shift.shiftType === 'NIGHT') {
                  pillBg = colors.purpleBg;
                  pillText = colors.purple;
                }
              }

              return (
                <TouchableOpacity
                  key={cell.dateStr}
                  onPress={() => handleSelectDay(cell.dateStr)}
                  activeOpacity={0.7}
                  style={[
                    styles.calendarCell,
                    !cell.isCurrentMonth && styles.calendarCellOtherMonth,
                    cell.isToday && styles.calendarCellToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumText,
                      !cell.isCurrentMonth && styles.dayNumTextOtherMonth,
                      cell.isToday && styles.dayNumTextToday,
                    ]}
                  >
                    {cell.dayNumber}
                  </Text>

                  {shift && (
                    <View style={[styles.shiftPill, { backgroundColor: pillBg }]}>
                      <Text
                        numberOfLines={1}
                        style={[styles.shiftPillText, { color: pillText }]}
                      >
                        {shift.shiftType === 'AFTERNOON'
                          ? 'AFT'
                          : shift.shiftType === 'MORNING'
                          ? 'MORN'
                          : shift.shiftType === 'NIGHT'
                          ? 'NIGHT'
                          : 'OFF'}
                        {shift.startAdjustmentMinutes > 0 ? ` +${shift.startAdjustmentMinutes}m` : ''}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.amber }]} />
            <Text style={styles.legendText}>Morning (06:00)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.indigo }]} />
            <Text style={styles.legendText}>Afternoon (14:30)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.purple }]} />
            <Text style={styles.legendText}>Night (22:30)</Text>
          </View>
        </View>
      </ScrollView>

      {/* 1. Edit Day Shift Modal */}
      <Modal visible={dayModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Set Shift for Day</Text>
                <Text style={styles.modalSubtitle}>{formatDateShort(selectedDate)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDayModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {/* Shift Preset Toggles */}
              <Text style={styles.inputLabel}>SELECT SHIFT TYPE</Text>
              <View style={styles.presetsGrid}>
                {shiftPresets.map((preset) => {
                  const IconComp = preset.icon;
                  const isSelected = editType === preset.type;
                  return (
                    <TouchableOpacity
                      key={preset.type}
                      onPress={() => {
                        setEditType(preset.type);
                        setEditIsOff(preset.isOff);
                        if (!preset.isOff) {
                          setEditStart(preset.start);
                          setEditEnd(preset.end);
                        }
                      }}
                      style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                    >
                      <IconComp
                        size={18}
                        color={isSelected ? preset.color : colors.textTertiary}
                      />
                      <Text
                        style={[styles.presetCardText, isSelected && { color: colors.textPrimary }]}
                      >
                        {preset.label}
                      </Text>
                      {preset.start ? (
                        <Text style={styles.presetTimeText}>{preset.start}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Hours (if not Day OFF) */}
              {!editIsOff && editType !== 'OFF' && (
                <>
                  <View style={styles.timeInputsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>PLANNED START (HH:MM)</Text>
                      <TextInput
                        value={editStart}
                        onChangeText={setEditStart}
                        placeholder="14:30"
                        placeholderTextColor={colors.textTertiary}
                        style={styles.textInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>PLANNED FINISH (HH:MM)</Text>
                      <TextInput
                        value={editEnd}
                        onChangeText={setEditEnd}
                        placeholder="23:00"
                        placeholderTextColor={colors.textTertiary}
                        style={styles.textInput}
                      />
                    </View>
                  </View>

                  {/* Start Adjustment Options */}
                  <Text style={styles.inputLabel}>START TIME ADJUSTMENT (LATE START)</Text>
                  <View style={styles.adjOptionsRow}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditAdjMinutes(0);
                        setCustomAdjInput('');
                      }}
                      style={[styles.adjOptionPill, editAdjMinutes === 0 && styles.adjOptionPillActive]}
                    >
                      <Text style={[styles.adjOptionText, editAdjMinutes === 0 && styles.adjOptionTextActive]}>
                        On Time (0m)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setEditAdjMinutes(15);
                        setCustomAdjInput('');
                      }}
                      style={[styles.adjOptionPill, editAdjMinutes === 15 && styles.adjOptionPillActive]}
                    >
                      <Text style={[styles.adjOptionText, editAdjMinutes === 15 && styles.adjOptionTextActive]}>
                        +15 min
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setEditAdjMinutes(30);
                        setCustomAdjInput('');
                      }}
                      style={[styles.adjOptionPill, editAdjMinutes === 30 && styles.adjOptionPillActive]}
                    >
                      <Text style={[styles.adjOptionText, editAdjMinutes === 30 && styles.adjOptionTextActive]}>
                        +30 min
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Custom adjustment input if needed */}
                  <View style={styles.customAdjRow}>
                    <TextInput
                      value={customAdjInput}
                      onChangeText={(val) => {
                        setCustomAdjInput(val);
                        const n = parseInt(val, 10);
                        if (!isNaN(n) && n >= 0) setEditAdjMinutes(n);
                      }}
                      placeholder="Custom late start (e.g. +20 min)"
                      keyboardType="numeric"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                    />
                  </View>

                  {/* Adjustment Summary Box */}
                  <View style={styles.adjSummaryBox}>
                    <View style={styles.adjSummaryRow}>
                      <Text style={styles.adjSummaryLabel}>Original Planned:</Text>
                      <Text style={styles.adjSummaryVal}>{editStart} → {editEnd}</Text>
                    </View>
                    <View style={styles.adjSummaryRow}>
                      <Text style={styles.adjSummaryLabel}>Adjustment:</Text>
                      <Text style={[styles.adjSummaryVal, { color: editAdjMinutes > 0 ? colors.amber : colors.textPrimary }]}>
                        {editAdjMinutes > 0 ? `+${editAdjMinutes} min late` : 'On time'}
                      </Text>
                    </View>
                    <View style={styles.adjSummaryRow}>
                      <Text style={styles.adjSummaryLabel}>Expected Auto-Start:</Text>
                      <Text style={[styles.adjSummaryVal, { color: colors.primaryLight, fontWeight: '800' }]}>
                        {computeExpectedStart(editStart, editAdjMinutes)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              {editShiftId && (
                <TouchableOpacity
                  onPress={() => {
                    confirm({
                      title: 'Remove Shift',
                      message: 'Are you sure you want to remove this shift from your schedule?',
                      confirmText: 'Remove',
                      isDestructive: true,
                      onConfirm: () => deleteShiftMutation.mutate(editShiftId),
                    });
                  }}
                  disabled={deleteShiftMutation.isPending}
                  style={styles.deleteButton}
                >
                  <Trash2 size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleSaveDay}
                disabled={saveShiftMutation.isPending}
                activeOpacity={0.85}
                style={[styles.saveButton, { flex: 1 }]}
              >
                {saveShiftMutation.isPending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Shift</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. Bulk Week Shift Editor Modal */}
      <Modal visible={bulkModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Set 7-Day Shift Week</Text>
                <Text style={styles.modalSubtitle}>
                  Week of {formatDateShort(bulkWeekStart)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setBulkModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Quick Actions */}
            <View style={styles.bulkQuickActionsRow}>
              <TouchableOpacity
                onPress={() => copyPreviousWeekMutation.mutate(bulkWeekStart)}
                disabled={copyPreviousWeekMutation.isPending}
                style={styles.copyPrevButton}
              >
                <Copy size={14} color={colors.primaryLight} />
                <Text style={styles.copyPrevButtonText}>Copy Previous Week</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setBulkShifts([
                    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 },
                    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 },
                    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 },
                    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 },
                    { type: 'AFTERNOON', isOff: false, adjMinutes: 0 },
                    { type: 'OFF', isOff: true, adjMinutes: 0 },
                    { type: 'OFF', isOff: true, adjMinutes: 0 },
                  ])
                }
                style={styles.monFriButton}
              >
                <Text style={styles.monFriButtonText}>Mon–Fri Afternoon</Text>
              </TouchableOpacity>
            </View>

            {/* 7-Day Quick Selector List */}
            <ScrollView style={{ maxHeight: 280, marginVertical: 8 }}>
              {DAYS_OF_WEEK.map((dayName, idx) => {
                const item = bulkShifts[idx] || { type: 'OFF', isOff: true, adjMinutes: 0 };
                return (
                  <View key={dayName} style={styles.bulkDayRow}>
                    <Text style={styles.bulkDayName}>{dayName}</Text>
                    <View style={styles.bulkTypeButtons}>
                      {['MORNING', 'AFTERNOON', 'NIGHT', 'OFF'].map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => {
                            const copy = [...bulkShifts];
                            copy[idx] = { type: t, isOff: t === 'OFF', adjMinutes: copy[idx]?.adjMinutes || 0 };
                            setBulkShifts(copy);
                          }}
                          style={[
                            styles.bulkTypePill,
                            item.type === t && styles.bulkTypePillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.bulkTypePillText,
                              item.type === t && styles.bulkTypePillTextActive,
                            ]}
                          >
                            {t === 'AFTERNOON' ? 'AFT' : t === 'MORNING' ? 'MORN' : t}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveBulkWeek}
              disabled={bulkSaveMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveButton}
            >
              {bulkSaveMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>Save Whole Week (Atomic)</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
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
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 6,
  },
  bulkButtonText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },

  // Month Nav
  monthNavCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  navArrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },

  // Calendar
  calendarContainer: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
    marginBottom: 16,
  },
  dayNamesRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  dayNameCell: {
    width: '14.285%',
    alignItems: 'center',
  },
  dayNameText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  gridCellsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  calendarCell: {
    width: '14.285%',
    minHeight: 62,
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 10,
    marginVertical: 2,
  },
  calendarCellOtherMonth: {
    opacity: 0.35,
  },
  calendarCellToday: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayNumText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  dayNumTextOtherMonth: {
    color: colors.textTertiary,
    fontWeight: '500',
  },
  dayNumTextToday: {
    color: colors.primaryLight,
    fontWeight: '900',
  },
  shiftPill: {
    width: '100%',
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
  },
  shiftPillText: {
    fontSize: 8,
    fontWeight: '800',
  },

  // Legend
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 11,
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
  presetsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  presetCard: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  presetCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  presetCardText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  presetTimeText: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '500',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
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

  // Adjustment Controls
  adjOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  adjOptionPill: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  adjOptionPillActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  adjOptionText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
  },
  adjOptionTextActive: {
    color: colors.primaryLight,
  },
  customAdjRow: {
    marginBottom: 12,
  },
  adjSummaryBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 14,
    gap: 4,
  },
  adjSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adjSummaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  adjSummaryVal: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  deleteButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },

  // Bulk modal
  bulkQuickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  copyPrevButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    gap: 5,
  },
  copyPrevButtonText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  monFriButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
  },
  monFriButtonText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  bulkDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  bulkDayName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    width: 40,
  },
  bulkTypeButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  bulkTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  bulkTypePillActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  bulkTypePillText: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
  },
  bulkTypePillTextActive: {
    color: colors.primaryLight,
  },
});
