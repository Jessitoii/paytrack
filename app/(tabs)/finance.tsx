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
} from 'lucide-react-native';
import { financeRepository } from '../../src/database';
import { formatEUR, formatDateShort } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

export default function FinanceScreen() {
  const queryClient = useQueryClient();

  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EXPENSES' | 'GOALS' | 'FORECAST'>('OVERVIEW');

  // Add Expense State
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseMerchant, setExpenseMerchant] = useState('');

  // Add Goal State
  const [goalName, setGoalName] = useState('');
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalCurrentAmount, setGoalCurrentAmount] = useState('');

  // Queries
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['localFinanceOverview'],
    queryFn: () => financeRepository.getMonthlyOverview(),
  });

  const { data: categories } = useQuery({
    queryKey: ['localExpenseCategories'],
    queryFn: () => financeRepository.listCategories(),
  });

  const { data: expenses } = useQuery({
    queryKey: ['localExpenses'],
    queryFn: () => financeRepository.listExpenses(),
  });

  const { data: savingsGoals } = useQuery({
    queryKey: ['localSavingsGoals'],
    queryFn: () => financeRepository.listSavingsGoals(),
  });

  const { data: forecast } = useQuery({
    queryKey: ['localFinanceForecast'],
    queryFn: () => financeRepository.getForecast(6),
  });

  // Mutations
  const createExpenseMutation = useMutation({
    mutationFn: (payload: any) => financeRepository.createExpense(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localExpenses'] });
      setExpenseModalVisible(false);
      setExpenseAmount('');
      setExpenseDescription('');
      setExpenseMerchant('');
      Alert.alert('Expense Added', 'Expense recorded successfully.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => financeRepository.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localExpenses'] });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const createGoalMutation = useMutation({
    mutationFn: (payload: any) => financeRepository.createSavingsGoal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localSavingsGoals'] });
      setGoalModalVisible(false);
      setGoalName('');
      setGoalTargetAmount('');
      setGoalCurrentAmount('');
      Alert.alert('Goal Created', 'New savings goal added.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleSaveExpense = () => {
    const amountNum = parseFloat(expenseAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid expense amount');
      return;
    }
    if (!expenseDescription.trim()) {
      Alert.alert('Validation Error', 'Please provide a description');
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

  const handleSaveGoal = () => {
    const targetNum = parseFloat(goalTargetAmount.replace(',', '.'));
    if (isNaN(targetNum) || targetNum <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid target amount');
      return;
    }
    if (!goalName.trim()) {
      Alert.alert('Validation Error', 'Please enter a goal name');
      return;
    }

    const currentNum = parseFloat(goalCurrentAmount.replace(',', '.')) || 0;

    createGoalMutation.mutate({
      name: goalName.trim(),
      targetAmount: targetNum,
      currentAmount: currentNum,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Wealth & Budget</Text>
            <Text style={styles.headerTitle}>Personal Finance</Text>
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

        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          {[
            { id: 'OVERVIEW', label: 'Overview' },
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
        </View>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <View>
            {/* Monthly Net Savings Hero Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>MONTHLY NET SAVINGS</Text>
              <Text style={styles.heroAmountText}>
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
                    <Text style={styles.statLabel}>Income</Text>
                  </View>
                  <Text style={styles.incomeValue}>
                    {formatEUR(overview?.income?.actual ?? 0)}
                  </Text>
                </View>

                <View style={styles.subStatWell}>
                  <View style={styles.statIconRow}>
                    <ArrowUpRight size={14} color={colors.danger} />
                    <Text style={styles.statLabel}>Expenses</Text>
                  </View>
                  <Text style={styles.expenseValue}>
                    {formatEUR(overview?.expenses?.total ?? 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Savings Goals Widget */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>SAVINGS GOALS</Text>
                <TouchableOpacity onPress={() => setGoalModalVisible(true)}>
                  <Plus size={16} color={colors.primaryLight} />
                </TouchableOpacity>
              </View>

              {savingsGoals?.length === 0 ? (
                <Text style={styles.emptyText}>No goals created yet.</Text>
              ) : (
                savingsGoals?.map((g: any) => (
                  <View key={g.id} style={styles.goalRow}>
                    <View style={styles.goalHeaderRow}>
                      <Text style={styles.goalName}>{g.name}</Text>
                      <Text style={styles.goalAmount}>
                        {formatEUR(g.currentAmount)} / {formatEUR(g.targetAmount)}
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

        {/* Tab 2: EXPENSES */}
        {activeTab === 'EXPENSES' && (
          <View>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>RECENT EXPENSES</Text>

              {expenses?.length === 0 ? (
                <Text style={styles.emptyText}>No expenses recorded yet.</Text>
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
                          {e.categoryName || 'Other'} • {formatDateShort(e.date)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.expenseItemRight}>
                      <Text style={styles.expenseAmountText}>-{formatEUR(e.amount)}</Text>
                      <TouchableOpacity
                        onPress={() => deleteExpenseMutation.mutate(e.id)}
                        style={{ marginLeft: 8 }}
                      >
                        <Trash2 size={14} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Tab 3: GOALS */}
        {activeTab === 'GOALS' && (
          <View>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>ALL SAVINGS GOALS</Text>
                <TouchableOpacity
                  onPress={() => setGoalModalVisible(true)}
                  style={styles.addSmallButton}
                >
                  <Plus size={14} color={colors.textInverse} />
                  <Text style={styles.addSmallButtonText}>New Goal</Text>
                </TouchableOpacity>
              </View>

              {savingsGoals?.map((g: any) => (
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
              ))}
            </View>
          </View>
        )}

        {/* Tab 4: FORECAST */}
        {activeTab === 'FORECAST' && (
          <View>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>6-MONTH WEALTH PROJECTION</Text>
              <Text style={styles.heroAmountText}>
                {formatEUR(forecast?.projections?.[5]?.projectedSavings ?? 0)}
              </Text>
              <Text style={styles.forecastSub}>
                Based on current monthly net savings of {formatEUR(forecast?.avgMonthlyNetSavings ?? 800)}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>MONTH-BY-MONTH ACCUMULATION</Text>
              {forecast?.projections?.map((p: any) => (
                <View key={p.monthIndex} style={styles.projectionRow}>
                  <Text style={styles.projectionMonth}>Month +{p.monthIndex}</Text>
                  <Text style={styles.projectionAmount}>{formatEUR(p.projectedSavings)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Expense Modal */}
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

      {/* Add Savings Goal Modal */}
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

            <Text style={styles.inputLabel}>INITIAL AMOUNT (€)</Text>
            <TextInput
              value={goalCurrentAmount}
              onChangeText={setGoalCurrentAmount}
              keyboardType="decimal-pad"
              placeholder="1500.00"
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
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabButtonText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: colors.primaryLight,
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
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroAmountText: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 6,
    letterSpacing: -0.5,
  },
  savingsRateRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  savingsPillText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
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
    gap: 5,
    marginBottom: 4,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
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

  // Section Card
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
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
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
    marginVertical: 6,
  },

  // Goals
  goalRow: {
    marginBottom: 14,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  goalName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  goalAmount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Expense List
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
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseDesc: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  expenseCategorySub: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
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

  // Forecast
  forecastSub: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontSize: 14,
    fontWeight: '800',
  },

  // Small add button
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
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  categoryPillText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: colors.primaryLight,
    fontWeight: '700',
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
});
