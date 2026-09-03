import React, { useState, useMemo } from 'react';
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
  Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Target,
  X,
  CreditCard,
  PieChart,
  Tag,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  Clock,
  Coins,
  CheckCircle2,
  FileText,
  Edit3,
  ArrowUp,
  ArrowDown,
  Calculator,
  Sparkles,
  Home,
} from 'lucide-react-native';
import { financeRepository } from '../../src/database';
import { useDatabaseRefresh } from '../../src/hooks/useDatabaseRefresh';
import { formatEUR, formatMinutes, formatDateShort } from '../../src/lib/formatters';
import { ColorPalette } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeContext';
import { useNotification } from '../../src/components/NotificationContext';
import { WeekSimulatorModal } from '../../src/components/WeekSimulatorModal';
import { BankConnectionCard } from '../../src/components/BankConnectionCard';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function FinanceScreen() {
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showSuccess, showError, confirm } = useNotification();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'INCOME' | 'FIXED_BILLS' | 'EXPENSES' | 'GOALS' | 'FORECAST'>('OVERVIEW');
  const [expenseFilter, setExpenseFilter] = useState<'ALL' | 'EXPENSES' | 'FIXED'>('ALL');

  // Modal States
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [editGoalModalVisible, setEditGoalModalVisible] = useState(false);
  const [simulateModalVisible, setSimulateModalVisible] = useState(false);

  // Add Expense State
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseMerchant, setExpenseMerchant] = useState('');

  // Add/Edit Fixed Bill State
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billCategoryId, setBillCategoryId] = useState('');
  const [billFrequency, setBillFrequency] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY');
  const [billDayOfMonth, setBillDayOfMonth] = useState('1');
  const [billDayOfWeek, setBillDayOfWeek] = useState('1');
  const [billNote, setBillNote] = useState('');

  // Add Goal State
  const [goalName, setGoalName] = useState('');
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalNotes, setGoalNotes] = useState('');

  // Edit Goal State
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [editGoalAmount, setEditGoalAmount] = useState('');

  // Navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Queries
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ['localFinanceOverview', selectedYear, selectedMonth],
    queryFn: () => financeRepository.getMonthlyOverview(selectedYear, selectedMonth),
  });

  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['localFinancialAnalytics', selectedYear, selectedMonth],
    queryFn: () => financeRepository.getFinancialAnalytics(selectedYear, selectedMonth),
  });

  const { data: categories } = useQuery({
    queryKey: ['localExpenseCategories'],
    queryFn: () => financeRepository.listCategories(),
  });

  const { data: fixedBills, refetch: refetchFixedBills } = useQuery({
    queryKey: ['localFixedBills', selectedYear, selectedMonth],
    queryFn: async () => {
      await financeRepository.ensureDefaultRentConfig();
      return financeRepository.listFixedBills(selectedYear, selectedMonth);
    },
  });

  const { data: expenses, refetch: refetchExpenses } = useQuery({
    queryKey: ['localExpenses', selectedYear, selectedMonth],
    queryFn: () => {
      const startStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endD = new Date(selectedYear, selectedMonth, 0).getDate();
      const endStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(endD).padStart(2, '0')}T23:59:59.999Z`;
      return financeRepository.listExpenses({ startDate: startStr, endDate: endStr });
    },
  });

  const { data: savingsGoals, refetch: refetchGoals } = useQuery({
    queryKey: ['localSavingsGoals'],
    queryFn: () => financeRepository.listSavingsGoals(),
  });

  const { data: forecast, refetch: refetchForecast } = useQuery({
    queryKey: ['localFinanceForecast'],
    queryFn: () => financeRepository.getForecast(6),
  });

  // DB Reactivity
  useDatabaseRefresh(['finance_changed', 'work_changed', 'payslips_changed'], () => {
    refetchOverview();
    refetchAnalytics();
    refetchFixedBills();
    refetchExpenses();
    refetchGoals();
    refetchForecast();
  });

  // Mutations
  const createExpenseMutation = useMutation({
    mutationFn: (payload: any) => financeRepository.createExpense(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['localFinancialAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
      setExpenseModalVisible(false);
      setExpenseAmount('');
      setExpenseDescription('');
      setExpenseMerchant('');
      showSuccess('Expense Added', 'Expense recorded successfully.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => financeRepository.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['localFinancialAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
      showSuccess('Expense Removed', 'Expense record deleted.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const createBillMutation = useMutation({
    mutationFn: (payload: any) => financeRepository.createFixedBill(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localFixedBills'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localFinancialAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
      setBillModalVisible(false);
      setBillName('');
      setBillAmount('');
      setBillFrequency('MONTHLY');
      setBillDayOfMonth('1');
      setBillDayOfWeek('1');
      setBillNote('');
      showSuccess('Fixed Bill Saved', 'Fixed recurring bill added.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const updateBillMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => financeRepository.updateFixedBill(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localFixedBills'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localFinancialAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
    },
  });

  const deleteBillMutation = useMutation({
    mutationFn: (id: string) => financeRepository.deleteFixedBill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localFixedBills'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localFinancialAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
      showSuccess('Bill Removed', 'Fixed bill removed.');
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: (payload: any) => financeRepository.createSavingsGoal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
      queryClient.invalidateQueries({ queryKey: ['localFinancialAnalytics'] });
      setGoalModalVisible(false);
      setGoalName('');
      setGoalTargetAmount('');
      setGoalNotes('');
      showSuccess('Goal Created', 'New savings goal added to sequential queue.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => financeRepository.updateSavingsGoal(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
      queryClient.invalidateQueries({ queryKey: ['localFinancialAnalytics'] });
      setEditGoalModalVisible(false);
      setSelectedGoal(null);
      setEditGoalAmount('');
      showSuccess('Goal Updated', 'Target amount saved.');
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => financeRepository.deleteSavingsGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
      queryClient.invalidateQueries({ queryKey: ['localFinancialAnalytics'] });
      showSuccess('Goal Removed', 'Savings goal deleted.');
    },
  });

  const reorderGoalsMutation = useMutation({
    mutationFn: (orderedIds: string[]) => financeRepository.reorderSavingsGoals(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
      queryClient.invalidateQueries({ queryKey: ['localFinancialAnalytics'] });
    },
  });

  const handleMoveGoal = (index: number, direction: 'up' | 'down') => {
    if (!savingsGoals) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= savingsGoals.length) return;

    const copy = [...savingsGoals];
    const item = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = item;

    reorderGoalsMutation.mutate(copy.map((g: any) => g.id));
  };

  // Action handlers
  const handleSaveExpense = () => {
    const amountNum = parseFloat(expenseAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      showError('Validation Error', 'Please enter a valid expense amount');
      return;
    }
    if (!expenseDescription.trim()) {
      showError('Validation Error', 'Please provide a description');
      return;
    }
    const catId = expenseCategoryId || categories?.[0]?.id || 'cat_other';
    createExpenseMutation.mutate({
      categoryId: catId,
      amount: amountNum,
      date: new Date(),
      description: expenseDescription.trim(),
      merchant: expenseMerchant.trim() || undefined,
    });
  };

  const handleSaveBill = () => {
    const amountNum = parseFloat(billAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      showError('Validation Error', 'Please enter a valid bill amount');
      return;
    }
    if (!billName.trim()) {
      showError('Validation Error', 'Please enter a bill name (e.g. Rent)');
      return;
    }
    const dayNum = parseInt(billDayOfMonth, 10) || 1;
    const dayWeekNum = parseInt(billDayOfWeek, 10) || 1;
    const catId = billCategoryId || categories?.[0]?.id || 'cat_other';

    createBillMutation.mutate({
      categoryId: catId,
      name: billName.trim(),
      amount: amountNum,
      frequency: billFrequency,
      dayOfMonth: billFrequency === 'MONTHLY' ? dayNum : 1,
      dayOfWeek: billFrequency === 'WEEKLY' ? dayWeekNum : 1,
      note: billNote.trim() || undefined,
    });
  };

  const handleSaveGoal = () => {
    const targetNum = parseFloat(goalTargetAmount.replace(',', '.'));
    if (isNaN(targetNum) || targetNum <= 0) {
      showError('Validation Error', 'Please enter a valid target amount');
      return;
    }
    if (!goalName.trim()) {
      showError('Validation Error', 'Please enter a goal name');
      return;
    }
    createGoalMutation.mutate({
      name: goalName.trim(),
      targetAmount: targetNum,
      notes: goalNotes.trim() || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Real Personal Finance</Text>
            <Text style={styles.headerTitle}>Wealth & Budget</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (categories?.length) setExpenseCategoryId(categories[0].id);
              setExpenseModalVisible(true);
            }}
            activeOpacity={0.8}
            style={styles.addExpenseButton}
          >
            <Plus size={15} color={colors.textInverse} />
            <Text style={styles.addExpenseButtonText}>Add Expense</Text>
          </TouchableOpacity>
        </View>

        {/* Month Selector Ribbon */}
        <View style={styles.monthNavRibbon}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrowBtn}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.navCenterGroup}>
            <Text style={styles.navMonthTitle}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </Text>
          </View>

          <TouchableOpacity onPress={handleNextMonth} style={styles.navArrowBtn}>
            <ChevronRight size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          {[
            { id: 'OVERVIEW', label: 'Overview' },
            { id: 'INCOME', label: 'Income' },
            { id: 'FIXED_BILLS', label: 'Fixed Bills' },
            { id: 'EXPENSES', label: 'Expenses' },
            { id: 'GOALS', label: 'Goals' },
            { id: 'FORECAST', label: '6M Forecast' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id as any)}
              style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === tab.id && styles.tabButtonTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <View>
            {/* Open Banking / ING Bank Connection Card */}
            <BankConnectionCard />

            {/* Monthly Net Savings Hero Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>THIS MONTH'S NET SAVINGS</Text>
              <Text style={[styles.heroAmountText, (overview?.savings?.monthlySavings ?? 0) < 0 && { color: colors.danger }]}>
                {formatEUR(overview?.savings?.monthlySavings ?? 0)}
              </Text>

              <View style={styles.savingsRateRow}>
                <View style={styles.savingsPill}>
                  <TrendingUp size={14} color={colors.primaryLight} />
                  <Text style={styles.savingsPillText}>
                    {overview?.savings?.savingsRatePercentage ?? 0}% Savings Rate
                  </Text>
                </View>
              </View>

              <View style={styles.incomeExpenseRow}>
                <View style={styles.subStatWell}>
                  <View style={styles.statIconRow}>
                    <ArrowDownLeft size={14} color={colors.primaryLight} />
                    <Text style={styles.statLabel}>Net Income</Text>
                  </View>
                  <Text style={styles.incomeValue}>
                    {formatEUR(overview?.income?.actual ?? 0)}
                  </Text>
                </View>

                <View style={styles.subStatWell}>
                  <View style={styles.statIconRow}>
                    <ArrowUpRight size={14} color={colors.danger} />
                    <Text style={styles.statLabel}>Total Expenses</Text>
                  </View>
                  <Text style={styles.expenseValue}>
                    {formatEUR(overview?.expenses?.total ?? 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Income & Expense Summary Breakdown Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>MONTHLY SUMMARY METRICS</Text>

              <View style={styles.metricItemRow}>
                <Text style={styles.metricItemLabel}>Net Income</Text>
                <Text style={[styles.metricItemValue, { color: colors.primaryLight }]}>
                  {formatEUR(overview?.income?.actual ?? 0)}
                </Text>
              </View>

              <View style={styles.metricItemRow}>
                <Text style={styles.metricItemLabel}>Fixed / Recurring Outflow</Text>
                <Text style={styles.metricItemValue}>{formatEUR(overview?.expenses?.fixedBills ?? 0)}</Text>
              </View>

              <View style={[styles.metricItemRow, { paddingLeft: 12, borderBottomWidth: 0, paddingVertical: 4 }]}>
                <Text style={[styles.metricItemLabel, { fontSize: 12, color: colors.textTertiary }]}>↳ Rent / Housing</Text>
                <Text style={[styles.metricItemValue, { fontSize: 12, color: colors.textSecondary }]}>
                  {formatEUR(overview?.expenses?.rent ?? 0)}
                </Text>
              </View>

              <View style={[styles.metricItemRow, { paddingLeft: 12, paddingTop: 0, paddingBottom: 6 }]}>
                <Text style={[styles.metricItemLabel, { fontSize: 12, color: colors.textTertiary }]}>↳ Other Recurring</Text>
                <Text style={[styles.metricItemValue, { fontSize: 12, color: colors.textSecondary }]}>
                  {formatEUR(overview?.expenses?.otherFixed ?? 0)}
                </Text>
              </View>

              <View style={styles.metricItemRow}>
                <Text style={styles.metricItemLabel}>Variable Expenses</Text>
                <Text style={[styles.metricItemValue, { color: colors.danger }]}>
                  {formatEUR(overview?.expenses?.variable ?? 0)}
                </Text>
              </View>

              <View style={[styles.metricItemRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                <Text style={[styles.metricItemLabel, { fontWeight: '800', color: colors.textPrimary }]}>Remaining (Net Savings)</Text>
                <Text style={[styles.metricItemValue, { fontSize: 15, color: (overview?.savings?.monthlySavings ?? 0) >= 0 ? colors.primaryLight : colors.danger }]}>
                  {formatEUR(overview?.savings?.monthlySavings ?? 0)}
                </Text>
              </View>
            </View>

            {/* Quick Savings Goals Widget */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>SAVINGS GOALS PROGRESS</Text>
                <TouchableOpacity onPress={() => setGoalModalVisible(true)}>
                  <Plus size={16} color={colors.primaryLight} />
                </TouchableOpacity>
              </View>

              {savingsGoals?.length === 0 ? (
                <Text style={styles.emptyText}>No goals created yet.</Text>
              ) : (
                savingsGoals?.slice(0, 3).map((g: any) => (
                  <View key={g.id} style={styles.goalRow}>
                    <View style={styles.goalHeaderRow}>
                      <Text style={styles.goalName}>{g.name}</Text>
                      <Text style={styles.goalAmount}>
                        {formatEUR(g.currentAmount)} / {formatEUR(g.targetAmount)} ({g.progressPercentage}%)
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${g.progressPercentage}%`, backgroundColor: g.color || colors.primary },
                        ]}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Tab 2: INCOME */}
        {activeTab === 'INCOME' && (
          <View>
            {/* Income Overview Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>MONTHLY EARNINGS</Text>
              <Text style={styles.heroAmountText}>
                {formatEUR(overview?.income?.actual ?? 0)}
              </Text>
              <Text style={styles.forecastSub}>
                {overview?.income?.payslipBank ? 'Based on Confirmed Payslips' : 'Calculated from Weekly Production Roster'}
              </Text>
            </View>

            {/* Payroll Components Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>PAYROLL COMPONENTS</Text>

              <View style={styles.metricItemRow}>
                <Text style={styles.metricItemLabel}>Base Work Income</Text>
                <Text style={styles.metricItemValue}>{formatEUR(overview?.income?.workIncome ?? 0)}</Text>
              </View>

              <View style={styles.metricItemRow}>
                <Text style={styles.metricItemLabel}>ADV Compensation</Text>
                <Text style={styles.metricItemValue}>{formatEUR(overview?.income?.advAllowance ?? 0)}</Text>
              </View>

              <View style={styles.metricItemRow}>
                <Text style={styles.metricItemLabel}>Holiday Allowance (8.33%)</Text>
                <Text style={styles.metricItemValue}>{formatEUR(overview?.income?.holidayAllowance ?? 0)}</Text>
              </View>

              <View style={styles.metricItemRow}>
                <Text style={styles.metricItemLabel}>Average Hourly Pay</Text>
                <Text style={[styles.metricItemValue, { color: colors.primaryLight }]}>
                  {formatEUR(overview?.income?.avgHourlyEarnings ?? 0)} / hr
                </Text>
              </View>
            </View>

            {/* ISO Weeks Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>WEEKLY INCOME BREAKDOWN</Text>

              {overview?.income?.weeklyBreakdown?.length === 0 ? (
                <Text style={styles.emptyText}>No weekly calculation records for this month yet.</Text>
              ) : (
                overview?.income?.weeklyBreakdown?.map((w: any) => (
                  <View key={`${w.year}_${w.weekNumber}`} style={styles.weeklyIncomeItem}>
                    <View>
                      <Text style={styles.weeklyIncomeTitle}>Week {w.weekNumber}</Text>
                      <Text style={styles.weeklyIncomeSub}>{formatMinutes(w.paidMinutes)} paid time</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.weeklyIncomeGross}>Gross: {formatEUR(w.estimatedGross)}</Text>
                      <Text style={styles.weeklyIncomeNet}>Net: {formatEUR(w.estimatedNet)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Tab 3 & 4: EXPENSES & FIXED BILLS */}
        {(activeTab === 'EXPENSES' || activeTab === 'FIXED_BILLS') && (
          <View>
            {/* View Mode Segmented Control (All | Expenses | Fixed) */}
            <View style={styles.segmentContainer}>
              {(['ALL', 'EXPENSES', 'FIXED'] as const).map((mode) => {
                const isSelected = activeTab === 'FIXED_BILLS' ? mode === 'FIXED' : expenseFilter === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => {
                      if (activeTab === 'FIXED_BILLS') {
                        setActiveTab('EXPENSES');
                      }
                      setExpenseFilter(mode);
                    }}
                    style={[styles.segmentBtn, isSelected && styles.segmentBtnActive]}
                  >
                    <Text style={[styles.segmentBtnText, isSelected && styles.segmentBtnTextActive]}>
                      {mode === 'ALL' ? 'All' : mode === 'EXPENSES' ? 'Expenses' : 'Fixed'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* When ALL or FIXED: show Fixed / Recurring Hero & Summary */}
            {(expenseFilter === 'ALL' || expenseFilter === 'FIXED' || activeTab === 'FIXED_BILLS') && (
              <View style={styles.heroCard}>
                <Text style={styles.heroLabel}>
                  {expenseFilter === 'ALL' ? "THIS MONTH'S OUTFLOW BREAKDOWN" : "MONTHLY FIXED & RECURRING BILLS"}
                </Text>
                <Text style={styles.heroAmountText}>
                  {expenseFilter === 'ALL'
                    ? formatEUR(overview?.expenses?.total ?? 0)
                    : formatEUR(overview?.expenses?.fixedBills ?? 0)}
                </Text>
                <View style={styles.incomeExpenseRow}>
                  <View style={styles.subStatWell}>
                    <View style={styles.statIconRow}>
                      <Home size={13} color={colors.primaryLight} />
                      <Text style={styles.statLabel}>Rent / Housing</Text>
                    </View>
                    <Text style={styles.incomeValue}>
                      {formatEUR(overview?.expenses?.rent ?? 0)}
                    </Text>
                  </View>

                  <View style={styles.subStatWell}>
                    <View style={styles.statIconRow}>
                      <CreditCard size={13} color={colors.textSecondary} />
                      <Text style={styles.statLabel}>Other Recurring</Text>
                    </View>
                    <Text style={[styles.statLabel, { fontSize: 16, fontWeight: '800', color: colors.textPrimary }]}>
                      {formatEUR(overview?.expenses?.otherFixed ?? 0)}
                    </Text>
                  </View>

                  {expenseFilter === 'ALL' && (
                    <View style={styles.subStatWell}>
                      <View style={styles.statIconRow}>
                        <Tag size={13} color={colors.danger} />
                        <Text style={styles.statLabel}>Variable</Text>
                      </View>
                      <Text style={styles.expenseValue}>
                        {formatEUR(overview?.expenses?.variable ?? 0)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* When EXPENSES only: show Variable Expenses Hero */}
            {expenseFilter === 'EXPENSES' && activeTab !== 'FIXED_BILLS' && (
              <View style={styles.heroCard}>
                <Text style={styles.heroLabel}>MONTHLY VARIABLE EXPENSES</Text>
                <Text style={[styles.heroAmountText, { color: colors.danger }]}>
                  {formatEUR(overview?.expenses?.variable ?? 0)}
                </Text>
                <Text style={styles.forecastSub}>
                  Day-to-day spending (Groceries, food, transport, shopping, entertainment)
                </Text>
              </View>
            )}

            {/* Fixed Bills Section (Shown when ALL or FIXED) */}
            {(expenseFilter === 'ALL' || expenseFilter === 'FIXED' || activeTab === 'FIXED_BILLS') && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>FIXED / RECURRING EXPENSES</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (categories?.length) setBillCategoryId(categories[0].id);
                      setBillModalVisible(true);
                    }}
                    style={styles.addSmallButton}
                  >
                    <Plus size={14} color={colors.textInverse} />
                    <Text style={styles.addSmallButtonText}>Add Bill</Text>
                  </TouchableOpacity>
                </View>

                {fixedBills?.length === 0 ? (
                  <Text style={styles.emptyText}>No fixed recurring bills added yet.</Text>
                ) : (
                  fixedBills?.map((b: any) => {
                    const isRent = b.isRent ?? (b.name?.toLowerCase().includes('rent') || b.name?.toLowerCase().includes('kira') || b.categoryId === 'cat_housing');
                    const isWeekly = (b.frequency || '').toUpperCase() === 'WEEKLY';
                    return (
                      <View key={b.id} style={styles.billItemRow}>
                        <View style={styles.billItemLeft}>
                          <View style={[styles.categoryIconCircle, { backgroundColor: isRent ? colors.primaryBg : (b.categoryColor || colors.primaryBg) }]}>
                            {isRent ? (
                              <Home size={15} color={colors.primary} />
                            ) : (
                              <CreditCard size={14} color={colors.textPrimary} />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.billName}>{b.name}</Text>
                              {isRent && (
                                <View style={styles.rentBadge}>
                                  <Text style={styles.rentBadgeText}>Rent</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.billSub}>
                              {isWeekly
                                ? `Weekly • Mondays • ${b.occurrences ?? 4}x in ${MONTH_NAMES[selectedMonth - 1].slice(0, 3)} (${formatEUR(b.monthAmount ?? (b.amount * 4))})`
                                : `Day ${b.dayOfMonth ?? 1} of month • ${b.categoryName || 'General'}`}
                            </Text>
                            {b.note && <Text style={styles.billNoteText}>{b.note}</Text>}
                          </View>
                        </View>

                        <View style={styles.billItemRight}>
                          <Text style={styles.billAmountText}>
                            {formatEUR(b.amount)}{isWeekly ? '/wk' : ''}
                          </Text>
                          <Switch
                            value={b.isActive}
                            onValueChange={(val) => updateBillMutation.mutate({ id: b.id, payload: { isActive: val } })}
                            trackColor={{ false: colors.cardBorder, true: colors.primary }}
                            thumbColor="#FFF"
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                          />
                          <TouchableOpacity
                            onPress={() => deleteBillMutation.mutate(b.id)}
                            style={{ marginLeft: 6 }}
                          >
                            <Trash2 size={15} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Variable Expenses Section (Shown when ALL or EXPENSES) */}
            {(expenseFilter === 'ALL' || expenseFilter === 'EXPENSES') && activeTab !== 'FIXED_BILLS' && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    {MONTH_NAMES[selectedMonth - 1].toUpperCase()} VARIABLE EXPENSES
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (categories?.length) setExpenseCategoryId(categories[0].id);
                      setExpenseModalVisible(true);
                    }}
                    style={styles.addSmallButton}
                  >
                    <Plus size={14} color={colors.textInverse} />
                    <Text style={styles.addSmallButtonText}>Add Expense</Text>
                  </TouchableOpacity>
                </View>

                {expenses?.length === 0 ? (
                  <Text style={styles.emptyText}>No variable expenses recorded for this month.</Text>
                ) : (
                  expenses?.map((e: any) => (
                    <View key={e.id} style={styles.expenseItemRow}>
                      <View style={styles.expenseItemLeft}>
                        <View style={styles.categoryIconCircle}>
                          <Tag size={14} color={colors.textPrimary} />
                        </View>
                        <View>
                          <Text style={styles.expenseDesc}>{e.description}</Text>
                          <Text style={styles.expenseCategorySub}>
                            {e.categoryName || 'Other'} • {formatDateShort(e.date)} {e.merchant ? `• ${e.merchant}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.expenseItemRight}>
                        <Text style={styles.expenseAmountText}>-{formatEUR(e.amount)}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            confirm({
                              title: 'Delete Expense',
                              message: `Delete "${e.description}" (-${formatEUR(e.amount)})?`,
                              confirmText: 'Delete',
                              isDestructive: true,
                              onConfirm: () => deleteExpenseMutation.mutate(e.id),
                            });
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          <Trash2 size={14} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* Tab 5: GOALS */}
        {activeTab === 'GOALS' && (
          <View>
            {/* Sequential Allocation Info Banner */}
            <View style={[styles.infoBanner, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
              <Sparkles size={16} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.infoBannerTitle, { color: colors.primary }]}>Sequential Allocation System</Text>
                <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
                  Your cumulative net savings ({formatEUR(analytics?.currentMonth?.availableSavings ?? 0)}) are prioritized in exact sequential order. Priority #1 fills to 100% before funds flow to Priority #2.
                </Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>SAVINGS QUEUE (PRIORITY ORDER)</Text>
                <TouchableOpacity
                  onPress={() => setGoalModalVisible(true)}
                  style={styles.addSmallButton}
                >
                  <Plus size={14} color={colors.textInverse} />
                  <Text style={styles.addSmallButtonText}>New Goal</Text>
                </TouchableOpacity>
              </View>

              {savingsGoals?.length === 0 ? (
                <Text style={styles.emptyText}>No savings goals set yet.</Text>
              ) : (
                savingsGoals?.map((g: any, idx: number) => (
                  <View key={g.id} style={styles.goalDetailCard}>
                    <View style={styles.goalHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <View style={[styles.priorityBadge, { backgroundColor: colors.backgroundSecondary }]}>
                            <Text style={[styles.priorityBadgeText, { color: colors.textTertiary }]}>#{idx + 1}</Text>
                          </View>
                          <Text style={styles.goalName}>{g.name}</Text>
                          {g.status === 'COMPLETED' ? (
                            <View style={[styles.statusBadge, { backgroundColor: colors.primaryBg }]}>
                              <Text style={[styles.statusBadgeText, { color: colors.primary }]}>Completed</Text>
                            </View>
                          ) : g.isCurrentTarget ? (
                            <View style={[styles.statusBadge, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                              <Text style={[styles.statusBadgeText, { color: colors.blue }]}>Active Target</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.goalAmount}>
                          {formatEUR(g.currentAmount)} of {formatEUR(g.targetAmount)} ({g.progressPercentage}%)
                          {g.remainingAmount > 0 ? ` • ${formatEUR(g.remainingAmount)} left` : ''}
                        </Text>
                      </View>

                      {/* Reorder and Delete Actions */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => handleMoveGoal(idx, 'up')}
                          disabled={idx === 0}
                          style={[styles.reorderBtn, idx === 0 && { opacity: 0.3 }]}
                        >
                          <ArrowUp size={14} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleMoveGoal(idx, 'down')}
                          disabled={idx === (savingsGoals.length - 1)}
                          style={[styles.reorderBtn, idx === (savingsGoals.length - 1) && { opacity: 0.3 }]}
                        >
                          <ArrowDown size={14} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            confirm({
                              title: 'Delete Goal',
                              message: `Delete "${g.name}"? Available funds will roll over to the next priority target.`,
                              confirmText: 'Delete',
                              isDestructive: true,
                              onConfirm: () => deleteGoalMutation.mutate(g.id),
                            });
                          }}
                          style={{ padding: 4 }}
                        >
                          <Trash2 size={15} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${g.progressPercentage}%`,
                            backgroundColor: g.status === 'COMPLETED' ? colors.primary : (g.color || colors.blue),
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Tab 6: FORECAST */}
        {activeTab === 'FORECAST' && (
          <View>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>6-MONTH WEALTH PROJECTION</Text>
              <Text style={styles.heroAmountText}>
                {formatEUR(forecast?.projections?.[5]?.projectedSavings ?? 0)}
              </Text>
              <Text style={styles.forecastSub}>
                Based on expected net monthly accumulation of {formatEUR(forecast?.expectedMonthlySavings ?? 800)}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>MONTH-BY-MONTH ACCUMULATION</Text>
              {forecast?.projections?.map((p: any) => (
                <View key={p.monthIndex} style={styles.projectionRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Calendar size={14} color={colors.textTertiary} />
                    <Text style={styles.projectionMonth}>{p.monthLabel}</Text>
                  </View>
                  <Text style={styles.projectionAmount}>{formatEUR(p.projectedSavings)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 1. Add Expense Modal */}
      <Modal visible={expenseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setExpenseModalVisible(false)} style={styles.closeButton}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>AMOUNT (€)</Text>
            <TextInput
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              keyboardType="decimal-pad"
              placeholder="45.50"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {categories?.map((cat: any) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setExpenseCategoryId(cat.id)}
                  style={[
                    styles.categoryPill,
                    expenseCategoryId === cat.id && styles.categoryPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      expenseCategoryId === cat.id && styles.categoryPillTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>DESCRIPTION</Text>
            <TextInput
              value={expenseDescription}
              onChangeText={setExpenseDescription}
              placeholder="Groceries / Albert Heijn"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>MERCHANT (OPTIONAL)</Text>
            <TextInput
              value={expenseMerchant}
              onChangeText={setExpenseMerchant}
              placeholder="AH Bleiswijk"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <TouchableOpacity
              onPress={handleSaveExpense}
              disabled={createExpenseMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveButton}
            >
              {createExpenseMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>Record Expense</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Add Fixed Bill Modal */}
      <Modal visible={billModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Fixed Recurring Bill</Text>
              <TouchableOpacity onPress={() => setBillModalVisible(false)} style={styles.closeButton}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>BILL NAME</Text>
            <TextInput
              value={billName}
              onChangeText={setBillName}
              placeholder="Rent / Kira, Gym, Internet, etc."
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>RECURRENCE FREQUENCY</Text>
            <View style={styles.freqToggleRow}>
              <TouchableOpacity
                onPress={() => setBillFrequency('MONTHLY')}
                style={[styles.freqPill, billFrequency === 'MONTHLY' && styles.freqPillActive]}
              >
                <Text style={[styles.freqPillText, billFrequency === 'MONTHLY' && styles.freqPillTextActive]}>
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBillFrequency('WEEKLY')}
                style={[styles.freqPill, billFrequency === 'WEEKLY' && styles.freqPillActive]}
              >
                <Text style={[styles.freqPillText, billFrequency === 'WEEKLY' && styles.freqPillTextActive]}>
                  Weekly (e.g. Rent)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>
              {billFrequency === 'WEEKLY' ? 'WEEKLY AMOUNT (€)' : 'MONTHLY AMOUNT (€)'}
            </Text>
            <TextInput
              value={billAmount}
              onChangeText={setBillAmount}
              keyboardType="decimal-pad"
              placeholder={billFrequency === 'WEEKLY' ? '160.00' : '450.00'}
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            {billFrequency === 'WEEKLY' ? (
              <View>
                <Text style={styles.inputLabel}>DAY OF WEEK</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {[
                    { id: '1', label: 'Monday' },
                    { id: '2', label: 'Tuesday' },
                    { id: '3', label: 'Wednesday' },
                    { id: '4', label: 'Thursday' },
                    { id: '5', label: 'Friday' },
                    { id: '6', label: 'Saturday' },
                    { id: '7', label: 'Sunday' },
                  ].map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      onPress={() => setBillDayOfWeek(d.id)}
                      style={[
                        styles.categoryPill,
                        billDayOfWeek === d.id && styles.categoryPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryPillText,
                          billDayOfWeek === d.id && styles.categoryPillTextActive,
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View>
                <Text style={styles.inputLabel}>DAY OF MONTH DUE (1-31)</Text>
                <TextInput
                  value={billDayOfMonth}
                  onChangeText={setBillDayOfMonth}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.textInput}
                />
              </View>
            )}

            <Text style={styles.inputLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {categories?.map((cat: any) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setBillCategoryId(cat.id)}
                  style={[
                    styles.categoryPill,
                    billCategoryId === cat.id && styles.categoryPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      billCategoryId === cat.id && styles.categoryPillTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>NOTE (OPTIONAL)</Text>
            <TextInput
              value={billNote}
              onChangeText={setBillNote}
              placeholder="Auto-debited from ABN AMRO"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <TouchableOpacity
              onPress={handleSaveBill}
              disabled={createBillMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveButton}
            >
              {createBillMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>Save Fixed Bill</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. Add Savings Goal Modal */}
      <Modal visible={goalModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Savings Goal</Text>
              <TouchableOpacity onPress={() => setGoalModalVisible(false)} style={styles.closeButton}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>GOAL NAME</Text>
            <TextInput
              value={goalName}
              onChangeText={setGoalName}
              placeholder="Emergency Fund / Vacation"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>TARGET AMOUNT (€)</Text>
            <TextInput
              value={goalTargetAmount}
              onChangeText={setGoalTargetAmount}
              keyboardType="decimal-pad"
              placeholder="5000.00"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
            <TextInput
              value={goalNotes}
              onChangeText={setGoalNotes}
              placeholder="e.g. For December flights"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <TouchableOpacity
              onPress={handleSaveGoal}
              disabled={createGoalMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveButton}
            >
              {createGoalMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>Create Goal</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. Update Goal Target Amount Modal */}
      <Modal visible={editGoalModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Goal Target</Text>
              <TouchableOpacity onPress={() => setEditGoalModalVisible(false)} style={styles.closeButton}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>TARGET AMOUNT FOR {selectedGoal?.name?.toUpperCase()}</Text>
            <TextInput
              value={editGoalAmount}
              onChangeText={setEditGoalAmount}
              keyboardType="decimal-pad"
              placeholder="2000.00"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <TouchableOpacity
              onPress={() => {
                const val = parseFloat(editGoalAmount.replace(',', '.'));
                if (isNaN(val) || val <= 0) {
                  showError('Invalid amount', 'Please enter a valid target amount');
                  return;
                }
                updateGoalMutation.mutate({
                  id: selectedGoal.id,
                  payload: { targetAmount: val },
                });
              }}
              disabled={updateGoalMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveButton}
            >
              {updateGoalMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>Save Target Amount</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Week Simulator Modal */}
      <WeekSimulatorModal
        visible={simulateModalVisible}
        onClose={() => setSimulateModalVisible(false)}
      />
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 5,
  },
  addExpenseButtonText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  monthNavRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCenterGroup: {
    alignItems: 'center',
  },
  navMonthTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  tabScroll: {
    marginBottom: 16,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  tabButtonText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: colors.primaryLight,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  segmentBtnTextActive: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  rentBadge: {
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rentBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  freqToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  freqPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  freqPillActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  freqPillText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  freqPillTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },

  // Hero Card
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 22,
    marginBottom: 16,
  },
  heroLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroAmountText: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 4,
  },
  savingsRateRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  savingsPillText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '800',
  },
  incomeExpenseRow: {
    flexDirection: 'row',
    gap: 12,
  },
  subStatWell: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  incomeValue: {
    color: colors.primaryLight,
    fontSize: 16,
    fontWeight: '800',
  },
  expenseValue: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '800',
  },
  forecastSub: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  // Sections
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  metricItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  metricItemLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  metricItemValue: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  addSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  addSmallButtonText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
  },

  // Weekly Income Item
  weeklyIncomeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 8,
  },
  weeklyIncomeTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  weeklyIncomeSub: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  weeklyIncomeGross: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  weeklyIncomeNet: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: '800',
  },

  // Fixed Bill Item
  billItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 8,
  },
  billItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  billSub: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 1,
  },
  billNoteText: {
    color: colors.textTertiary,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },
  billItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  billAmountText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },

  // Expense Item
  expenseItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  expenseItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  expenseDesc: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  expenseCategorySub: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 1,
  },
  expenseItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseAmountText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },

  // Goals
  goalRow: {
    marginBottom: 14,
  },
  goalDetailCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  goalName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  goalAmount: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  editGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  editGoalBtnText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '700',
  },

  // Forecast
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  projectionMonth: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  projectionAmount: {
    color: colors.primaryLight,
    fontSize: 15,
    fontWeight: '900',
  },

  // Modals
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
  categoryPill: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  categoryPillText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: colors.primaryLight,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  reorderBtn: {
    padding: 6,
    borderRadius: 6,
  },
  infoBanner: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoBannerText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  simulateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  simulateHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  etaWell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  etaTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  etaSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
