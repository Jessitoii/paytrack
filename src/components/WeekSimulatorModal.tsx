import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {
  Calculator,
  X,
  Clock,
  DollarSign,
  Calendar,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowRight,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { simulateWeek, DaySimulationInput } from '../payroll/weekSimulator';
import { formatEUR } from '../lib/formatters';

interface WeekSimulatorModalProps {
  visible: boolean;
  onClose: () => void;
  scheduledHours?: number;
}

export function WeekSimulatorModal({
  visible,
  onClose,
  scheduledHours,
}: WeekSimulatorModalProps) {
  const { colors, isDark } = useTheme();

  const [inputMode, setInputMode] = useState<'total' | 'daily'>('total');
  const [totalHoursInput, setTotalHoursInput] = useState('40');
  const [unpaidBreakInput, setUnpaidBreakInput] = useState('30');

  const [days, setDays] = useState<DaySimulationInput[]>([
    { day: 'Monday', hours: 8 },
    { day: 'Tuesday', hours: 8 },
    { day: 'Wednesday', hours: 8 },
    { day: 'Thursday', hours: 8 },
    { day: 'Friday', hours: 8 },
    { day: 'Saturday', hours: 0 },
    { day: 'Sunday', hours: 0 },
  ]);

  const simulation = useMemo(() => {
    const unpaidBreak = parseFloat(unpaidBreakInput) || 0;
    if (inputMode === 'total') {
      const hours = parseFloat(totalHoursInput) || 0;
      return simulateWeek({
        totalHours: hours,
        unpaidBreakMinutes: unpaidBreak,
      });
    } else {
      return simulateWeek({
        days,
        unpaidBreakMinutes: unpaidBreak,
      });
    }
  }, [inputMode, totalHoursInput, unpaidBreakInput, days]);

  const handleUseScheduled = () => {
    if (scheduledHours && scheduledHours > 0) {
      setInputMode('total');
      setTotalHoursInput(scheduledHours.toFixed(1));
    }
  };

  const updateDayHours = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    setDays((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], hours: Math.max(0, Math.min(24, num)) };
      return copy;
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <SafeAreaView style={styles.safeArea}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            {/* Header */}
            <View style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.headerTitleGroup}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primaryBg }]}>
                  <Calculator size={22} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                    Simulate Week
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    In-memory calculation without modifying work records
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Mode Selector */}
              <View style={[styles.tabBar, { backgroundColor: colors.backgroundSecondary }]}>
                <TouchableOpacity
                  onPress={() => setInputMode('total')}
                  style={[
                    styles.tabItem,
                    inputMode === 'total' && [styles.activeTab, { backgroundColor: colors.card }],
                  ]}
                >
                  <Clock size={16} color={inputMode === 'total' ? colors.primary : colors.textTertiary} />
                  <Text
                    style={[
                      styles.tabText,
                      { color: inputMode === 'total' ? colors.textPrimary : colors.textTertiary },
                    ]}
                  >
                    Total Hours
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setInputMode('daily')}
                  style={[
                    styles.tabItem,
                    inputMode === 'daily' && [styles.activeTab, { backgroundColor: colors.card }],
                  ]}
                >
                  <Calendar size={16} color={inputMode === 'daily' ? colors.primary : colors.textTertiary} />
                  <Text
                    style={[
                      styles.tabText,
                      { color: inputMode === 'daily' ? colors.textPrimary : colors.textTertiary },
                    ]}
                  >
                    Day by Day
                  </Text>
                </TouchableOpacity>
              </View>

              {scheduledHours && scheduledHours > 0 ? (
                <TouchableOpacity
                  onPress={handleUseScheduled}
                  style={[
                    styles.scheduledBanner,
                    { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                  ]}
                >
                  <Zap size={16} color={colors.primary} />
                  <Text style={[styles.scheduledBannerText, { color: colors.primary }]}>
                    Use Scheduled Roster ({scheduledHours.toFixed(1)}h planned this week)
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Mode 1: Total Hours */}
              {inputMode === 'total' ? (
                <View style={styles.inputSection}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Weekly Working Hours
                  </Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}>
                    <TextInput
                      style={[styles.numericInput, { color: colors.textPrimary }]}
                      keyboardType="numeric"
                      value={totalHoursInput}
                      onChangeText={setTotalHoursInput}
                      placeholder="40"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={[styles.inputUnit, { color: colors.textTertiary }]}>hours</Text>
                  </View>
                </View>
              ) : (
                /* Mode 2: Daily Breakdown */
                <View style={styles.dailySection}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                    Daily Hours
                  </Text>
                  {days.map((d, idx) => (
                    <View
                      key={d.day}
                      style={[
                        styles.dayRow,
                        { borderBottomColor: colors.cardBorder, backgroundColor: colors.backgroundSecondary },
                      ]}
                    >
                      <Text style={[styles.dayLabel, { color: colors.textPrimary }]}>{d.day}</Text>
                      <View style={styles.dayInputContainer}>
                        <TextInput
                          style={[styles.dayInput, { color: colors.textPrimary, borderColor: colors.cardBorder }]}
                          keyboardType="numeric"
                          value={String(d.hours)}
                          onChangeText={(v) => updateDayHours(idx, v)}
                        />
                        <Text style={[styles.dayUnit, { color: colors.textTertiary }]}>h</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Simulation Results Card */}
              <View
                style={[
                  styles.resultCard,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.resultSectionTitle, { color: colors.textPrimary }]}>
                  Projected Earnings ({simulation.paidHours}h @ {formatEUR(simulation.hourlyRate)}/h)
                </Text>

                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
                    Estimated Gross
                  </Text>
                  <Text style={[styles.resultValue, { color: colors.textPrimary }]}>
                    {formatEUR(simulation.estimatedGross)}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
                    ADV Allowance (8.14%)
                  </Text>
                  <Text style={[styles.resultValue, { color: colors.textPrimary }]}>
                    +{formatEUR(simulation.advAllowance)}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
                    Holiday Allowance (8.00%)
                  </Text>
                  <Text style={[styles.resultValue, { color: colors.textPrimary }]}>
                    +{formatEUR(simulation.holidayAllowance)}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
                    Total Deductions & Taxes
                  </Text>
                  <Text style={[styles.resultValue, { color: colors.danger }]}>
                    -{formatEUR(simulation.totalDeductions)}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

                <View style={styles.highlightRow}>
                  <Text style={[styles.highlightLabel, { color: colors.textPrimary }]}>
                    Estimated Bank Payout
                  </Text>
                  <Text style={[styles.highlightValue, { color: colors.primary }]}>
                    {formatEUR(simulation.estimatedBankPayout)}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
                    Est. Weekly Fixed Expenses
                  </Text>
                  <Text style={[styles.resultValue, { color: colors.textTertiary }]}>
                    -{formatEUR(simulation.weeklyFixedExpenses)}
                  </Text>
                </View>

                <View style={[styles.savingsHighlight, { backgroundColor: colors.primaryBg }]}>
                  <TrendingUp size={18} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.savingsLabel, { color: colors.primary }]}>
                      Projected Weekly Savings
                    </Text>
                    <Text style={[styles.savingsSubtext, { color: colors.textSecondary }]}>
                      ≈ {formatEUR(simulation.goalImpact.projectedMonthlySavings)}/month toward goals
                    </Text>
                  </View>
                  <Text style={[styles.savingsAmount, { color: colors.primary }]}>
                    {formatEUR(simulation.projectedWeeklySavings)}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  scrollContent: {
    padding: 20,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  scheduledBannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  numericInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 12,
  },
  inputUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  dailySection: {
    marginBottom: 20,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayInput: {
    width: 60,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 6,
  },
  dayUnit: {
    fontSize: 13,
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  resultSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  resultLabel: {
    fontSize: 13,
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  highlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  highlightLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  highlightValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  savingsHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  savingsLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  savingsSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  savingsAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
});
