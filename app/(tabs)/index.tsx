import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ShieldCheck,
  LogOut,
  Play,
  CheckCircle2,
  Wallet,
  Coins,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { formatEUR, formatMinutes, formatTimeHHMM, formatDateShort } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const { data: workData, isLoading: workLoading, refetch: refetchWork } = useQuery({
    queryKey: ['workSessions'],
    queryFn: () => api.listWorkSessions(),
  });

  const { data: shiftsData, refetch: refetchShifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => api.listShifts(),
  });

  const { data: financeData, refetch: refetchFinance } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.getOverview(),
  });

  const activeSession = workData?.sessions?.find((s: any) => s.status === 'WORKING');
  const totalPaidMinutesThisWeek =
    workData?.sessions?.reduce((acc: number, s: any) => acc + (s.paidMinutes || 0), 0) || 0;
  const nextShift = shiftsData?.shifts?.[0];

  const onRefresh = () => {
    refetchWork();
    refetchShifts();
    refetchFinance();
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of PayTrack?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // Time-based greeting
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  const estimatedGross = (totalPaidMinutesThisWeek / 60) * 16.34;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={workLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.userNameText}>{user?.name || 'Worker'}</Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.employerBadge}>
              <ShieldCheck size={14} color={colors.primary} />
              <Text style={styles.employerBadgeText}>AH Bleiswijk</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} activeOpacity={0.7} style={styles.logoutButton}>
              <LogOut size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. Active Work Status / Quick Punch Card */}
        {activeSession ? (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/work' as any)}
            activeOpacity={0.85}
            style={styles.activeWorkCard}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.liveIndicatorRow}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveIndicatorText}>SHIFT IN PROGRESS</Text>
              </View>
              <ArrowUpRight size={18} color={colors.primaryLight} />
            </View>
            <Text style={styles.activeStartTimeText}>
              Started at {formatTimeHHMM(activeSession.actualStart)}
            </Text>
            <Text style={styles.activeCardHint}>Tap to add breaks or finish with 5-min rounding</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/work' as any)}
            activeOpacity={0.85}
            style={styles.readyWorkCard}
          >
            <View style={styles.readyWorkLeft}>
              <View style={styles.readyIconWrapper}>
                <Clock size={22} color={colors.primary} />
              </View>
              <View style={styles.readyTextGroup}>
                <Text style={styles.readyTitle}>Ready for Work?</Text>
                <Text style={styles.readySubtitle}>1-Tap start timestamp recording</Text>
              </View>
            </View>
            <View style={styles.startBadge}>
              <Play size={12} color={colors.textInverse} fill={colors.textInverse} />
              <Text style={styles.startBadgeText}>START</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 2. Weekly Payroll Summary Card (Hero Element) */}
        <View style={styles.payrollCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>THIS WEEK'S ESTIMATE</Text>
            <View style={styles.hoursBadge}>
              <CheckCircle2 size={12} color={colors.primary} />
              <Text style={styles.hoursBadgeText}>{formatMinutes(totalPaidMinutesThisWeek)} Worked</Text>
            </View>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.grossAmountText}>{formatEUR(estimatedGross)}</Text>
            <Text style={styles.grossLabelText}>gross estimate</Text>
          </View>

          <View style={styles.divider} />

          {/* Hourly Rate & Allowances Breakdown */}
          <View style={styles.rateGrid}>
            <View style={styles.rateGridCol}>
              <Text style={styles.rateColLabel}>Base Wage</Text>
              <Text style={styles.rateColValue}>€ 14,99/h</Text>
            </View>
            <View style={styles.rateGridCol}>
              <Text style={styles.rateColLabel}>ADV Allowance</Text>
              <Text style={styles.rateColValue}>+€ 1,35/h</Text>
            </View>
            <View style={styles.rateGridCol}>
              <Text style={styles.rateColLabel}>Holiday Pay</Text>
              <Text style={styles.rateColValue}>8,00%</Text>
            </View>
          </View>
        </View>

        {/* 3. Monthly Finance Snapshot Card */}
        <View style={styles.financeCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <Wallet size={16} color={colors.blue} />
              <Text style={[styles.sectionLabel, { marginLeft: 8, color: colors.textPrimary }]}>
                Monthly Savings & Wealth
              </Text>
            </View>
            <View style={styles.savingsRateBadge}>
              <Text style={styles.savingsRateText}>
                {financeData?.overview?.savings?.savingsRatePercentage ?? 0}% Saved
              </Text>
            </View>
          </View>

          <Text style={styles.monthlySavingsAmount}>
            {formatEUR(financeData?.overview?.savings?.monthlySavings ?? 0)}
          </Text>

          <View style={styles.financeWellsRow}>
            <View style={styles.financeWell}>
              <Text style={styles.wellLabel}>Total Income</Text>
              <Text style={styles.wellIncomeValue}>
                {formatEUR(financeData?.overview?.income?.actual ?? 0)}
              </Text>
            </View>
            <View style={styles.financeWell}>
              <Text style={styles.wellLabel}>Total Expenses</Text>
              <Text style={styles.wellExpenseValue}>
                {formatEUR(financeData?.overview?.expenses?.total ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. Next Planned Shift Card */}
        <View style={styles.shiftCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>NEXT SCHEDULED SHIFT</Text>
            <Calendar size={16} color={colors.textSecondary} />
          </View>

          {nextShift ? (
            <View style={styles.shiftDetailRow}>
              <View>
                <Text style={styles.shiftTitle}>{nextShift.shiftType} Shift</Text>
                <Text style={styles.shiftTimeSubtitle}>
                  {formatDateShort(nextShift.date)} • {formatTimeHHMM(nextShift.plannedStart)} –{' '}
                  {formatTimeHHMM(nextShift.plannedEnd)}
                </Text>
              </View>
              <View style={styles.shiftTypePill}>
                <Text style={styles.shiftTypePillText}>{nextShift.shiftType}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyShiftText}>No planned shifts for this week.</Text>
          )}
        </View>
      </ScrollView>
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
  greetingText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  userNameText: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  employerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  employerBadgeText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Active Work Card
  activeWorkCard: {
    backgroundColor: 'rgba(6, 78, 59, 0.4)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
    marginRight: 8,
  },
  liveIndicatorText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  activeStartTimeText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  activeCardHint: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    opacity: 0.9,
  },

  // Ready Work Card
  readyWorkCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readyWorkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  readyIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  readyTextGroup: {
    flex: 1,
  },
  readyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  readySubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  startBadge: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  startBadgeText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Payroll Hero Card
  payrollCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  hoursBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  hoursBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 12,
    gap: 8,
  },
  grossAmountText: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  grossLabelText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 12,
  },
  rateGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rateGridCol: {
    flex: 1,
  },
  rateColLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  rateColValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },

  // Finance Card
  financeCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
  },
  iconHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsRateBadge: {
    backgroundColor: colors.blueBg,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsRateText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '800',
  },
  monthlySavingsAmount: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    marginVertical: 8,
  },
  financeWellsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  financeWell: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  wellLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  wellIncomeValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  wellExpenseValue: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },

  // Shift Card
  shiftCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 24,
    padding: 20,
  },
  shiftDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  shiftTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  shiftTimeSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  shiftTypePill: {
    backgroundColor: colors.indigoBg,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  shiftTypePillText: {
    color: colors.indigo,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyShiftText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
});
