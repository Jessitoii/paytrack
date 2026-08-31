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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Copy,
  Sliders,
  Sun,
  Sunset,
  Moon,
  Coffee,
  CheckCircle2,
} from 'lucide-react-native';
import { shiftRepository } from '../../src/database';
import { formatDateShort, formatTimeHHMM } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

const SHIFT_PRESETS = [
  { label: 'Morning', type: 'MORNING', start: '06:00', end: '14:30', isOff: false, icon: Sun, color: colors.amber },
  { label: 'Afternoon', type: 'AFTERNOON', start: '14:30', end: '23:00', isOff: false, icon: Sunset, color: colors.indigo },
  { label: 'Night', type: 'NIGHT', start: '22:30', end: '06:00', isOff: false, icon: Moon, color: colors.purple },
  { label: 'OFF', type: 'OFF', start: '', end: '', isOff: true, icon: Coffee, color: colors.textTertiary },
];

export default function ShiftsScreen() {
  const queryClient = useQueryClient();

  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().substring(0, 10));

  // Modals
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);

  // Day Edit State
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [editType, setEditType] = useState('AFTERNOON');
  const [editStart, setEditStart] = useState('14:30');
  const [editEnd, setEditEnd] = useState('23:00');
  const [editIsOff, setEditIsOff] = useState(false);
  const [editNotes, setEditNotes] = useState('');

  // Bulk Week State (Monday to Sunday)
  const [bulkWeekStart, setBulkWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().substring(0, 10);
  });
  const [bulkShifts, setBulkShifts] = useState<Array<{ type: string; isOff: boolean }>>([
    { type: 'AFTERNOON', isOff: false }, // Mon
    { type: 'AFTERNOON', isOff: false }, // Tue
    { type: 'AFTERNOON', isOff: false }, // Wed
    { type: 'AFTERNOON', isOff: false }, // Thu
    { type: 'AFTERNOON', isOff: false }, // Fri
    { type: 'OFF', isOff: true },        // Sat
    { type: 'OFF', isOff: true },        // Sun
  ]);

  // Query month range
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

  const { data: shifts, isLoading, refetch } = useQuery({
    queryKey: ['localShifts', year, month],
    queryFn: () =>
      shiftRepository.listShifts({
        startDate: firstDay,
        endDate: lastDay,
      }),
  });

  // Mutations
  const saveShiftMutation = useMutation({
    mutationFn: (payload: any) => shiftRepository.saveShift(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localShifts'] });
      setDayModalVisible(false);
      Alert.alert('Shift Saved', 'Shift schedule updated.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => shiftRepository.deleteShift(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localShifts'] });
      setDayModalVisible(false);
      Alert.alert('Shift Removed', 'Shift removed from calendar.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const bulkSaveMutation = useMutation({
    mutationFn: (payload: any) => shiftRepository.bulkSaveWeek(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localShifts'] });
      setBulkModalVisible(false);
      Alert.alert('Week Configured', '7-day shift roster saved atomically.');
    },
    onError: (err: any) => Alert.alert('Bulk Save Error', err.message),
  });

  const copyPreviousWeekMutation = useMutation({
    mutationFn: (targetWeekStartDate: string) =>
      shiftRepository.copyPreviousWeek({ targetWeekStartDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localShifts'] });
      setBulkModalVisible(false);
      Alert.alert('Copied Successfully', 'Copied previous week roster.');
    },
    onError: (err: any) => Alert.alert('Copy Error', err.message),
  });

  // Month navigation
  const prevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  // Calendar Grid Generation (Mon to Sun)
  const monthName = currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Mon=0, Sun=6
  const totalDays = lastDay.getDate();

  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(Date.UTC(year, month, day));
    calendarCells.push(d.toISOString().substring(0, 10));
  }

  const todayStr = new Date().toISOString().substring(0, 10);

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
      setEditNotes(existing.notes || '');
    } else {
      setEditShiftId(null);
      setEditType('AFTERNOON');
      setEditIsOff(false);
      setEditStart('14:30');
      setEditEnd('23:00');
      setEditNotes('');
    }

    setDayModalVisible(true);
  };

  // Save Day Shift
  const handleSaveDay = () => {
    const baseDate = new Date(selectedDate);

    let plannedStart: Date | null = null;
    let plannedEnd: Date | null = null;

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
    }

    saveShiftMutation.mutate({
      id: editShiftId || undefined,
      date: baseDate,
      shiftType: editType,
      plannedStart,
      plannedEnd,
      isDayOff: editIsOff || editType === 'OFF',
      notes: editNotes || undefined,
    });
  };

  // Save Bulk Week
  const handleSaveBulkWeek = () => {
    const monday = new Date(bulkWeekStart);
    monday.setHours(0, 0, 0, 0);

    const weekShiftsPayload = bulkShifts.map((item, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);

      let plannedStart: Date | null = null;
      let plannedEnd: Date | null = null;

      if (!item.isOff && item.type !== 'OFF') {
        const preset = SHIFT_PRESETS.find((p) => p.type === item.type) || SHIFT_PRESETS[1];
        const [sh, sm] = preset.start.split(':').map(Number);
        const [eh, em] = preset.end.split(':').map(Number);

        plannedStart = new Date(d);
        plannedStart.setHours(sh, sm, 0, 0);

        plannedEnd = new Date(d);
        plannedEnd.setHours(eh, em, 0, 0);
        if (eh < sh) plannedEnd.setDate(plannedEnd.getDate() + 1);
      }

      return {
        date: d,
        shiftType: item.type,
        plannedStart,
        plannedEnd,
        isDayOff: item.isOff || item.type === 'OFF',
      };
    });

    bulkSaveMutation.mutate({
      weekStartDate: monday,
      shifts: weekShiftsPayload,
    });
  };

  const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
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
          {/* Day Names Row */}
          <View style={styles.dayNamesRow}>
            {DAYS_OF_WEEK.map((dayName, idx) => (
              <View key={idx} style={styles.dayNameCell}>
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

          {/* Calendar Grid Cells */}
          <View style={styles.gridCellsContainer}>
            {calendarCells.map((dateStr, idx) => {
              if (!dateStr) {
                return <View key={`empty_${idx}`} style={styles.cellEmpty} />;
              }

              const dayNum = parseInt(dateStr.split('-')[2], 10);
              const isToday = dateStr === todayStr;
              const shift = shifts?.find((s: any) => s.date.substring(0, 10) === dateStr);

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
                  key={dateStr}
                  onPress={() => handleSelectDay(dateStr)}
                  activeOpacity={0.7}
                  style={[styles.calendarCell, isToday && styles.calendarCellToday]}
                >
                  <Text style={[styles.dayNumText, isToday && styles.dayNumTextToday]}>
                    {dayNum}
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

            {/* Shift Preset Toggles */}
            <Text style={styles.inputLabel}>SELECT SHIFT TYPE</Text>
            <View style={styles.presetsGrid}>
              {SHIFT_PRESETS.map((preset) => {
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
              <View style={styles.timeInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>START (HH:MM)</Text>
                  <TextInput
                    value={editStart}
                    onChangeText={setEditStart}
                    placeholder="14:30"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>FINISH (HH:MM)</Text>
                  <TextInput
                    value={editEnd}
                    onChangeText={setEditEnd}
                    placeholder="23:00"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.textInput}
                  />
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              {editShiftId && (
                <TouchableOpacity
                  onPress={() => deleteShiftMutation.mutate(editShiftId)}
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
                    { type: 'AFTERNOON', isOff: false },
                    { type: 'AFTERNOON', isOff: false },
                    { type: 'AFTERNOON', isOff: false },
                    { type: 'AFTERNOON', isOff: false },
                    { type: 'AFTERNOON', isOff: false },
                    { type: 'OFF', isOff: true },
                    { type: 'OFF', isOff: true },
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
                const item = bulkShifts[idx] || { type: 'OFF', isOff: true };
                return (
                  <View key={dayName} style={styles.bulkDayRow}>
                    <Text style={styles.bulkDayName}>{dayName}</Text>
                    <View style={styles.bulkTypeButtons}>
                      {['MORNING', 'AFTERNOON', 'NIGHT', 'OFF'].map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => {
                            const copy = [...bulkShifts];
                            copy[idx] = { type: t, isOff: t === 'OFF' };
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    padding: 12,
    marginBottom: 16,
  },
  dayNamesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  dayNameCell: {
    flex: 1,
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
    marginTop: 8,
  },
  cellEmpty: {
    width: '14.28%',
    height: 64,
  },
  calendarCell: {
    width: '14.28%',
    height: 64,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 10,
  },
  calendarCellToday: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayNumText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
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
    fontSize: 9,
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
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetCard: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 12,
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
    gap: 12,
    marginBottom: 16,
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
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
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
