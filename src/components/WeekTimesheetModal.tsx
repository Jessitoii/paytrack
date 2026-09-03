import React, { useState, useEffect, useMemo } from 'react';
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
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  CheckCircle2,
  Plus,
  X,
  Edit3,
  Calendar,
  Coffee,
  Utensils,
  Trash2,
  Sliders,
  Sparkles,
} from 'lucide-react-native';
import { workRepository } from '../database/repositories/workRepository';
import { useDatabaseRefresh } from '../hooks/useDatabaseRefresh';
import { formatEUR, formatMinutes, formatTimeHHMM, formatDateShort } from '../lib/formatters';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface WeekTimesheetModalProps {
  visible: boolean;
  initialYear?: number;
  initialWeekNumber?: number;
  onClose: () => void;
  onAddWorkDate?: (dateStr: string) => void;
  onEditSession?: (session: any) => void;
}

interface BreakItem {
  id: string;
  type: string;
  name: string;
  durationMinutes: number;
  isPaid: boolean;
  startTime?: string;
  endTime?: string;
}

export function WeekTimesheetModal({
  visible,
  initialYear,
  initialWeekNumber,
  onClose,
  onAddWorkDate,
  onEditSession,
}: WeekTimesheetModalProps) {
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const now = new Date();
  const currentBounds = workRepository ? { year: now.getFullYear(), weekNumber: 36 } : { year: 2026, weekNumber: 36 };

  const [selectedYear, setSelectedYear] = useState<number>(initialYear || now.getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeekNumber || 36);

  useEffect(() => {
    if (initialYear) setSelectedYear(initialYear);
    if (initialWeekNumber) setSelectedWeek(initialWeekNumber);
  }, [initialYear, initialWeekNumber, visible]);

  // Query Timesheet detail
  const { data: timesheetData, isLoading, refetch: refetchTimesheet } = useQuery({
    queryKey: ['localWeekTimesheet', selectedYear, selectedWeek],
    queryFn: () => workRepository.getWeekTimesheetDetail(selectedYear, selectedWeek),
    enabled: visible,
  });

  useDatabaseRefresh(['work_changed', 'shifts_changed'], refetchTimesheet);

  // Week navigation
  const handlePrevWeek = () => {
    if (selectedWeek === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedWeek(52);
    } else {
      setSelectedWeek((w) => w - 1);
    }
  };

  const handleNextWeek = () => {
    if (selectedWeek === 52) {
      setSelectedYear((y) => y + 1);
      setSelectedWeek(1);
    } else {
      setSelectedWeek((w) => w + 1);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerSubtitle}>Production Timesheet</Text>
              <Text style={styles.headerTitle}>Week {selectedWeek}</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Week Selector Ribbon */}
          <View style={styles.navRibbon}>
            <TouchableOpacity onPress={handlePrevWeek} style={styles.navArrowBtn}>
              <ChevronLeft size={20} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.navCenterGroup}>
              <Text style={styles.navWeekTitle}>
                Week {selectedWeek} • {selectedYear}
              </Text>
              <Text style={styles.navDateSubtitle}>
                {timesheetData?.summary?.formattedRange || 'Loading dates...'}
              </Text>
            </View>

            <TouchableOpacity onPress={handleNextWeek} style={styles.navArrowBtn}>
              <ChevronRight size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
              {/* 1. Weekly Summary Card */}
              <View style={styles.summaryCard}>
                <Text style={styles.sectionHeaderLabel}>WEEKLY SUMMARY</Text>

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Worked</Text>
                    <Text style={styles.summaryValue}>
                      {formatMinutes(timesheetData?.summary?.totalWorkedMinutes || 0)}
                    </Text>
                  </View>

                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Paid Time</Text>
                    <Text style={[styles.summaryValue, { color: colors.primaryLight }]}>
                      {formatMinutes(timesheetData?.summary?.totalPaidMinutes || 0)}
                    </Text>
                  </View>

                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Est. Gross</Text>
                    <Text style={styles.summaryValue}>
                      {formatEUR(timesheetData?.summary?.estimatedGross || 0)}
                    </Text>
                  </View>

                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Est. Net</Text>
                    <Text style={[styles.summaryValue, { color: colors.primaryLight }]}>
                      {formatEUR(timesheetData?.summary?.estimatedNet || 0)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 2. All 7 Days (Monday to Sunday) */}
              <View style={styles.daysListSection}>
                <Text style={styles.sectionHeaderLabel}>DAY-BY-DAY TIMESHEET</Text>

                {timesheetData?.days?.map((day: any) => {
                  const hasWork = day.hasWork;
                  const session = day.primarySession;
                  const shift = day.shift;

                  return (
                    <View key={day.dateStr} style={[styles.dayCard, day.isToday && styles.dayCardToday]}>
                      {/* Day Header Row */}
                      <View style={styles.dayCardHeader}>
                        <View style={styles.dayDateLeft}>
                          <Text style={[styles.dayNameText, day.isToday && { color: colors.primaryLight }]}>
                            {day.dayName}
                          </Text>
                          <Text style={styles.dayFormattedDate}>— {day.formattedDate}</Text>
                        </View>

                        {hasWork ? (
                          <View style={styles.completedBadge}>
                            <CheckCircle2 size={12} color={colors.primaryLight} />
                            <Text style={styles.completedBadgeText}>Completed</Text>
                          </View>
                        ) : (
                          <View style={styles.offBadge}>
                            <Text style={styles.offBadgeText}>
                              {day.isDayOff ? 'ROSTERED OFF' : 'NO WORK'}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Shift / Work Details */}
                      {hasWork ? (
                        <View style={styles.workDetailContainer}>
                          {/* Planned Shift vs Actual */}
                          <View style={styles.plannedVsActualRow}>
                            {shift && (
                              <View style={styles.timeBlock}>
                                <Text style={styles.timeBlockLabel}>Planned Roster</Text>
                                <Text style={styles.timeBlockValue}>
                                  {shift.plannedStart ? formatTimeHHMM(shift.plannedStart) : '--'} →{' '}
                                  {shift.plannedEnd ? formatTimeHHMM(shift.plannedEnd) : '--'}
                                </Text>
                              </View>
                            )}

                            <View style={styles.timeBlock}>
                              <Text style={styles.timeBlockLabel}>Actual Worked</Text>
                              <Text style={styles.timeBlockValue}>
                                {formatTimeHHMM(session.actualStart)} →{' '}
                                {session.rawFinish ? formatTimeHHMM(session.rawFinish) : '--:--'}
                              </Text>
                            </View>

                            <View style={styles.timeBlock}>
                              <Text style={styles.timeBlockLabel}>5-Min Rounded</Text>
                              <Text style={[styles.timeBlockValue, { color: colors.primaryLight, fontWeight: '800' }]}>
                                {formatTimeHHMM(session.actualStart)} →{' '}
                                {session.roundedFinish ? formatTimeHHMM(session.roundedFinish) : '--:--'}
                              </Text>
                            </View>
                          </View>

                          {/* Breaks Display */}
                          {session.breaks && session.breaks.length > 0 && (
                            <View style={styles.breaksRow}>
                              {session.breaks.map((b: any, bIdx: number) => (
                                <View
                                  key={bIdx}
                                  style={[
                                    styles.breakPill,
                                    b.isPaid ? styles.breakPillPaid : styles.breakPillUnpaid,
                                  ]}
                                >
                                  {b.durationMinutes >= 30 ? (
                                    <Utensils size={11} color={b.isPaid ? colors.primaryLight : colors.amber} />
                                  ) : (
                                    <Coffee size={11} color={b.isPaid ? colors.primaryLight : colors.amber} />
                                  )}
                                  <Text
                                    style={[
                                      styles.breakPillText,
                                      b.isPaid ? { color: colors.primaryLight } : { color: colors.amber },
                                    ]}
                                  >
                                    {b.durationMinutes}m {b.isPaid ? 'Paid' : 'Unpaid'}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Paid Time & Gross */}
                          <View style={styles.paidTimeGrossRow}>
                            <View>
                              <Text style={styles.subTextLabel}>Paid Time</Text>
                              <Text style={styles.paidTimeValue}>{formatMinutes(day.paidMinutes)}</Text>
                            </View>

                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.subTextLabel}>Gross Earnings</Text>
                              <Text style={styles.grossValue}>{formatEUR(day.grossAmount)}</Text>
                            </View>

                            <TouchableOpacity
                              onPress={() => onEditSession && onEditSession(session)}
                              style={styles.editDayBtn}
                            >
                              <Edit3 size={14} color={colors.textSecondary} />
                              <Text style={styles.editDayBtnText}>Edit</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        /* Empty State for Day */
                        <View style={styles.emptyDayContainer}>
                          <View>
                            <Text style={styles.emptyDayMessage}>
                              {shift && !shift.isDayOff
                                ? `Planned ${shift.shiftType} (${shift.plannedStart ? formatTimeHHMM(shift.plannedStart) : ''} - ${shift.plannedEnd ? formatTimeHHMM(shift.plannedEnd) : ''}) • No work recorded`
                                : 'OFF / NO WORK RECORDED'}
                            </Text>
                          </View>

                          <TouchableOpacity
                            onPress={() => onAddWorkDate && onAddWorkDate(day.dateStr)}
                            style={styles.addWorkBtn}
                          >
                            <Plus size={13} color={colors.primaryLight} />
                            <Text style={styles.addWorkBtnText}>Add Work</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 18 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCenterGroup: {
    alignItems: 'center',
  },
  navWeekTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  navDateSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  daysListSection: {
    marginTop: 4,
  },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 12,
  },
  dayCardToday: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(6, 78, 59, 0.25)',
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayDateLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  dayNameText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dayFormattedDate: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
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
  completedBadgeText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  offBadge: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  offBadgeText: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
  },
  workDetailContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  plannedVsActualRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  timeBlock: {
    flex: 1,
    minWidth: 90,
  },
  timeBlockLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
  },
  timeBlockValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  breaksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  breakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  breakPillPaid: {
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  breakPillUnpaid: {
    backgroundColor: colors.amberBg,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  breakPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  paidTimeGrossRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  subTextLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '600',
  },
  paidTimeValue: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
  },
  grossValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  editDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  editDayBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyDayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptyDayMessage: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  addWorkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  addWorkBtnText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
});
