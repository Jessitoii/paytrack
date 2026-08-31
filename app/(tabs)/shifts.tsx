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
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Sun,
  Sunset,
  Moon,
  Coffee,
  X,
  Clock,
  Copy,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { formatDateShort, formatTimeHHMM } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

const SHIFT_TYPES = [
  { type: 'MORNING', label: 'Morning', icon: Sun, color: colors.amber, defaultStart: '06:00', defaultEnd: '15:00' },
  { type: 'AFTERNOON', label: 'Afternoon', icon: Sunset, color: colors.blue, defaultStart: '14:30', defaultEnd: '23:00' },
  { type: 'NIGHT', label: 'Night', icon: Moon, color: colors.indigo, defaultStart: '22:30', defaultEnd: '07:00' },
  { type: 'OFF', label: 'Day Off', icon: Coffee, color: colors.primary, defaultStart: '', defaultEnd: '' },
  { type: 'CUSTOM', label: 'Custom', icon: Clock, color: '#A855F7', defaultStart: '08:00', defaultEnd: '16:30' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ShiftsScreen() {
  const queryClient = useQueryClient();

  // Current calendar view month/year
  const [currentDate, setCurrentDate] = useState(new Date());

  // Single Day Edit Modal
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [dayShiftType, setDayShiftType] = useState('AFTERNOON');
  const [dayStartTime, setDayStartTime] = useState('14:30');
  const [dayEndTime, setDayEndTime] = useState('23:00');
  const [dayNotes, setDayNotes] = useState('');
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);

  // Weekly Bulk Modal
  const [weekModalVisible, setWeekModalVisible] = useState(false);
  const [weekStartMonday, setWeekStartMonday] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [weeklyShiftsDraft, setWeeklyShiftsDraft] = useState<
    Array<{
      date: Date;
      shiftType: string;
      startTime: string;
      endTime: string;
      isDayOff: boolean;
      notes: string;
    }>
  >([]);

  // Fetch shifts for current month +/- 1 month
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);

  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['shifts', currentDate.getFullYear(), currentDate.getMonth()],
    queryFn: () =>
      api.listShifts({
        startDate: monthStart.toISOString(),
        endDate: monthEnd.toISOString(),
      }),
  });

  const shifts = shiftsData?.shifts || [];

  // Index shifts by YYYY-MM-DD
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of shifts) {
      const dStr = new Date(s.date).toISOString().substring(0, 10);
      map.set(dStr, s);
    }
    return map;
  }, [shifts]);

  // Mutations
  const createOrUpdateShiftMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (activeShiftId) {
        return api.updateShift(activeShiftId, payload);
      }
      return api.createShift(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setDayModalVisible(false);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => api.deleteShift(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setDayModalVisible(false);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const bulkSaveWeekMutation = useMutation({
    mutationFn: (payload: { weekStartDate: Date; shifts: any[] }) =>
      api.bulkSaveWeek(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setWeekModalVisible(false);
      Alert.alert('Week Scheduled', '7-day weekly schedule saved successfully.');
    },
    onError: (err: any) => Alert.alert('Bulk Save Error', err.message),
  });

  const copyPreviousWeekMutation = useMutation({
    mutationFn: (targetWeekStartDate: Date) =>
      api.copyPreviousWeek({ targetWeekStartDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setWeekModalVisible(false);
      Alert.alert('Success', 'Previous week shifts copied successfully.');
    },
    onError: (err: any) => Alert.alert('Copy Error', err.message),
  });

  // Calendar Navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Generate 6x7 Calendar Grid
  const calendarCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Day of week 1(Mon)..7(Sun)
    let startDayOfWeek = firstDay.getDay() || 7;

    const cells: Array<{ date: Date; isCurrentMonth: boolean; key: string }> = [];

    // Preceding month trailing days
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i > 0; i--) {
      const d = new Date(year, month - 1, prevLastDay - i + 1);
      cells.push({ date: d, isCurrentMonth: false, key: `prev-${d.toISOString()}` });
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const d = new Date(year, month, day);
      cells.push({ date: d, isCurrentMonth: true, key: `curr-${day}` });
    }

    // Following month leading days to complete grid
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ date: d, isCurrentMonth: false, key: `next-${i}` });
    }

    return cells;
  }, [currentDate]);

  // Open Single Day Modal
  const handleDayPress = (date: Date) => {
    setSelectedDay(date);
    const dStr = date.toISOString().substring(0, 10);
    const existing = shiftsByDate.get(dStr);

    if (existing) {
      setActiveShiftId(existing.id);
      setDayShiftType(existing.shiftType);
      setDayStartTime(
        existing.plannedStart ? formatTimeHHMM(existing.plannedStart) : '14:30'
      );
      setDayEndTime(
        existing.plannedEnd ? formatTimeHHMM(existing.plannedEnd) : '23:00'
      );
      setDayNotes(existing.notes || '');
    } else {
      setActiveShiftId(null);
      setDayShiftType('AFTERNOON');
      setDayStartTime('14:30');
      setDayEndTime('23:00');
      setDayNotes('');
    }

    setDayModalVisible(true);
  };

  const handleSaveDayShift = () => {
    if (!selectedDay) return;
    const isDayOff = dayShiftType === 'OFF';

    let plannedStart: Date | undefined;
    let plannedEnd: Date | undefined;

    if (!isDayOff) {
      const [sh, sm] = dayStartTime.split(':').map(Number);
      const [eh, em] = dayEndTime.split(':').map(Number);

      plannedStart = new Date(selectedDay);
      plannedStart.setHours(sh || 14, sm || 30, 0, 0);

      plannedEnd = new Date(selectedDay);
      plannedEnd.setHours(eh || 23, em || 0, 0, 0);

      if (eh < sh) {
        plannedEnd.setDate(plannedEnd.getDate() + 1);
      }
    }

    createOrUpdateShiftMutation.mutate({
      date: selectedDay,
      shiftType: dayShiftType,
      plannedStart,
      plannedEnd,
      isDayOff,
      notes: dayNotes || undefined,
    });
  };

  // Open Weekly Bulk Editor
  const handleOpenWeekModal = () => {
    // Generate draft for 7 days starting from weekStartMonday
    const draft = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartMonday);
      d.setDate(weekStartMonday.getDate() + i);
      const dStr = d.toISOString().substring(0, 10);
      const existing = shiftsByDate.get(dStr);

      if (existing) {
        draft.push({
          date: d,
          shiftType: existing.shiftType,
          startTime: existing.plannedStart ? formatTimeHHMM(existing.plannedStart) : '14:30',
          endTime: existing.plannedEnd ? formatTimeHHMM(existing.plannedEnd) : '23:00',
          isDayOff: existing.isDayOff,
          notes: existing.notes || '',
        });
      } else {
        // Default weekday template (Mon-Fri Afternoon, Sat-Sun OFF)
        const isWeekend = i >= 5;
        draft.push({
          date: d,
          shiftType: isWeekend ? 'OFF' : 'AFTERNOON',
          startTime: isWeekend ? '' : '14:30',
          endTime: isWeekend ? '' : '23:00',
          isDayOff: isWeekend,
          notes: '',
        });
      }
    }

    setWeeklyShiftsDraft(draft);
    setWeekModalVisible(true);
  };

  const handleApplyToAllWeekdays = (sourceIndex: number) => {
    const template = weeklyShiftsDraft[sourceIndex];
    setWeeklyShiftsDraft((prev) =>
      prev.map((item, idx) => {
        if (idx < 5) {
          return {
            ...item,
            shiftType: template.shiftType,
            startTime: template.startTime,
            endTime: template.endTime,
            isDayOff: template.isDayOff,
          };
        }
        return item;
      })
    );
  };

  const handleClearWeek = () => {
    setWeeklyShiftsDraft((prev) =>
      prev.map((item) => ({
        ...item,
        shiftType: 'OFF',
        startTime: '',
        endTime: '',
        isDayOff: true,
      }))
    );
  };

  const handleSaveWeek = () => {
    const formattedShifts = weeklyShiftsDraft.map((item) => {
      const isDayOff = item.shiftType === 'OFF' || item.isDayOff;
      let plannedStart: Date | undefined;
      let plannedEnd: Date | undefined;

      if (!isDayOff && item.startTime && item.endTime) {
        const [sh, sm] = item.startTime.split(':').map(Number);
        const [eh, em] = item.endTime.split(':').map(Number);

        plannedStart = new Date(item.date);
        plannedStart.setHours(sh || 14, sm || 30, 0, 0);

        plannedEnd = new Date(item.date);
        plannedEnd.setHours(eh || 23, em || 0, 0, 0);

        if (eh < sh) {
          plannedEnd.setDate(plannedEnd.getDate() + 1);
        }
      }

      return {
        date: item.date,
        shiftType: item.shiftType,
        plannedStart,
        plannedEnd,
        isDayOff,
        notes: item.notes || undefined,
      };
    });

    bulkSaveWeekMutation.mutate({
      weekStartDate: weekStartMonday,
      shifts: formattedShifts,
    });
  };

  const todayStr = new Date().toISOString().substring(0, 10);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Roster & Auto-Start</Text>
            <Text style={styles.headerTitle}>Shifts Calendar</Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenWeekModal}
            activeOpacity={0.8}
            style={styles.setWeekButton}
          >
            <Layers size={16} color={colors.textInverse} />
            <Text style={styles.setWeekButtonText}>Set Week</Text>
          </TouchableOpacity>
        </View>

        {/* Month Switcher Bar */}
        <View style={styles.monthBar}>
          <TouchableOpacity onPress={prevMonth} activeOpacity={0.7} style={styles.monthNavButton}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthTitleText}>{monthName}</Text>
          <TouchableOpacity onPress={nextMonth} activeOpacity={0.7} style={styles.monthNavButton}>
            <ChevronRight size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Weekday Column Headers */}
        <View style={styles.weekdayHeaderRow}>
          {WEEKDAYS.map((day, idx) => (
            <View key={day} style={styles.weekdayCol}>
              <Text
                style={[
                  styles.weekdayHeaderText,
                  idx >= 5 && { color: colors.textTertiary },
                ]}
              >
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* 7-Column Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarCells.map((cell) => {
            const cellDateStr = cell.date.toISOString().substring(0, 10);
            const shift = shiftsByDate.get(cellDateStr);
            const isToday = cellDateStr === todayStr;

            let shiftConfig = null;
            if (shift) {
              shiftConfig =
                SHIFT_TYPES.find((t) => t.type === shift.shiftType) || SHIFT_TYPES[4];
            }

            return (
              <TouchableOpacity
                key={cell.key}
                onPress={() => handleDayPress(cell.date)}
                activeOpacity={0.75}
                style={[
                  styles.calendarCell,
                  !cell.isCurrentMonth && styles.calendarCellMuted,
                  isToday && styles.calendarCellToday,
                ]}
              >
                {/* Day Number */}
                <View style={styles.cellDayHeader}>
                  <Text
                    style={[
                      styles.cellDayNumber,
                      !cell.isCurrentMonth && styles.cellDayNumberMuted,
                      isToday && styles.cellDayNumberToday,
                    ]}
                  >
                    {cell.date.getDate()}
                  </Text>
                  {isToday && <View style={styles.todayIndicatorDot} />}
                </View>

                {/* Shift Indicator Chip */}
                {shift && shiftConfig && (
                  <View
                    style={[
                      styles.cellShiftBadge,
                      {
                        backgroundColor: `${shiftConfig.color}25`,
                        borderColor: `${shiftConfig.color}60`,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.cellShiftText, { color: shiftConfig.color }]}
                    >
                      {shift.shiftType === 'OFF'
                        ? 'OFF'
                        : shift.plannedStart
                        ? formatTimeHHMM(shift.plannedStart)
                        : shiftConfig.label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>SHIFT CODES</Text>
          <View style={styles.legendGrid}>
            {SHIFT_TYPES.map((t) => (
              <View key={t.type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: t.color }]} />
                <Text style={styles.legendLabel}>
                  {t.label} {t.defaultStart ? `(${t.defaultStart})` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 1. Single Day Shift Modal */}
      <Modal visible={dayModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedDay ? formatDateShort(selectedDay) : 'Schedule Shift'}
                </Text>
                <Text style={styles.modalSubtitle}>Configure Daily Work Shift</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDayModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Shift Type Pills */}
            <Text style={styles.inputLabel}>SHIFT TYPE</Text>
            <View style={styles.shiftTypeSelector}>
              {SHIFT_TYPES.map((t) => {
                const isSelected = dayShiftType === t.type;
                return (
                  <TouchableOpacity
                    key={t.type}
                    onPress={() => {
                      setDayShiftType(t.type);
                      if (t.defaultStart) setDayStartTime(t.defaultStart);
                      if (t.defaultEnd) setDayEndTime(t.defaultEnd);
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.typeOption,
                      isSelected && {
                        borderColor: t.color,
                        backgroundColor: `${t.color}25`,
                      },
                    ]}
                  >
                    <t.icon size={15} color={isSelected ? t.color : colors.textTertiary} />
                    <Text
                      style={[
                        styles.typeOptionText,
                        isSelected && { color: t.color, fontWeight: '800' },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {dayShiftType !== 'OFF' && (
              <View style={styles.timeInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>START TIME (HH:MM)</Text>
                  <TextInput
                    value={dayStartTime}
                    onChangeText={setDayStartTime}
                    placeholder="14:30"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>END TIME (HH:MM)</Text>
                  <TextInput
                    value={dayEndTime}
                    onChangeText={setDayEndTime}
                    placeholder="23:00"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.textInput}
                  />
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>NOTES / DEPARTMENT (OPTIONAL)</Text>
            <TextInput
              value={dayNotes}
              onChangeText={setDayNotes}
              placeholder="Bleiswijk Order Picking / Staging"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <View style={styles.dayModalActionsRow}>
              {activeShiftId && (
                <TouchableOpacity
                  onPress={() => deleteShiftMutation.mutate(activeShiftId)}
                  disabled={deleteShiftMutation.isPending}
                  style={styles.deleteShiftButton}
                >
                  <Trash2 size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleSaveDayShift}
                disabled={createOrUpdateShiftMutation.isPending}
                activeOpacity={0.85}
                style={[styles.saveShiftButton, { flex: 1 }]}
              >
                {createOrUpdateShiftMutation.isPending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.saveShiftButtonText}>Save Shift</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. Set Entire Week Bulk Modal */}
      <Modal visible={weekModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Set Weekly Schedule</Text>
                <Text style={styles.modalSubtitle}>
                  Week starting Monday, {formatDateShort(weekStartMonday)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setWeekModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Quick Actions Toolbar */}
            <View style={styles.weekToolbar}>
              <TouchableOpacity
                onPress={() => copyPreviousWeekMutation.mutate(weekStartMonday)}
                disabled={copyPreviousWeekMutation.isPending}
                style={styles.weekToolbarButton}
              >
                <Copy size={14} color={colors.primaryLight} />
                <Text style={styles.weekToolbarText}>Copy Prev Week</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleApplyToAllWeekdays(0)}
                style={styles.weekToolbarButton}
              >
                <Sparkles size={14} color={colors.blue} />
                <Text style={styles.weekToolbarText}>Copy Mon $\rightarrow$ Fri</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleClearWeek} style={styles.weekToolbarButton}>
                <Trash2 size={14} color={colors.danger} />
                <Text style={[styles.weekToolbarText, { color: colors.danger }]}>Clear</Text>
              </TouchableOpacity>
            </View>

            {/* 7 Days List Editor */}
            <ScrollView style={{ marginVertical: 10 }}>
              {weeklyShiftsDraft.map((item, idx) => (
                <View key={idx} style={styles.weekDayRow}>
                  <View style={styles.weekDayLabelCol}>
                    <Text style={styles.weekDayName}>{WEEKDAYS[idx]}</Text>
                    <Text style={styles.weekDayDate}>{item.date.getDate()}</Text>
                  </View>

                  {/* Shift Selector Buttons */}
                  <View style={styles.weekDayPillsRow}>
                    {SHIFT_TYPES.map((t) => {
                      const isSelected = item.shiftType === t.type;
                      return (
                        <TouchableOpacity
                          key={t.type}
                          onPress={() => {
                            setWeeklyShiftsDraft((prev) =>
                              prev.map((d, dIdx) =>
                                dIdx === idx
                                  ? {
                                      ...d,
                                      shiftType: t.type,
                                      startTime: t.defaultStart,
                                      endTime: t.defaultEnd,
                                      isDayOff: t.type === 'OFF',
                                    }
                                  : d
                              )
                            );
                          }}
                          style={[
                            styles.weekDayPill,
                            isSelected && {
                              backgroundColor: `${t.color}25`,
                              borderColor: t.color,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.weekDayPillText,
                              isSelected && { color: t.color, fontWeight: '800' },
                            ]}
                          >
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveWeek}
              disabled={bulkSaveWeekMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveShiftButton}
            >
              {bulkSaveWeekMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveShiftButtonText}>Save Full Week (Atomic)</Text>
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
  setWeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  setWeekButtonText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '800',
  },

  // Month Switcher
  monthBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Weekday Header
  weekdayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayHeaderText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Calendar Grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 6,
    marginBottom: 16,
  },
  calendarCell: {
    width: '14.285%',
    height: 72,
    padding: 4,
    borderRadius: 10,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calendarCellMuted: {
    opacity: 0.35,
  },
  calendarCellToday: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  cellDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cellDayNumber: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  cellDayNumberMuted: {
    color: colors.textTertiary,
  },
  cellDayNumberToday: {
    color: colors.primaryLight,
    fontWeight: '900',
  },
  todayIndicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
  cellShiftBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  cellShiftText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // Legend
  legendContainer: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  legendTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal Sheet
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
  shiftTypeSelector: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 3,
  },
  typeOptionText: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 12,
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
  dayModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  deleteShiftButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveShiftButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveShiftButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },

  // Week Editor Styles
  weekToolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  weekToolbarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    gap: 5,
  },
  weekToolbarText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  weekDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  weekDayLabelCol: {
    width: 44,
    alignItems: 'center',
  },
  weekDayName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  weekDayDate: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  weekDayPillsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  weekDayPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
  },
  weekDayPillText: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '600',
  },
});
