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
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  Plus,
  TrendingUp,
  Target,
  Tag,
  X,
  PiggyBank,
  CheckCircle,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { formatEUR } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

export default function FinanceScreen() {
  const queryClient = useQueryClient();
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);

  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.getOverview(),
  });

  const { data: goalsData } = useQuery({
    queryKey: ['savingsGoals'],
    queryFn: () => api.listSavingsGoals(),
  });

  const { data: forecastData } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.getForecast(6),
  });

  const categories = categoriesData?.categories || [];

  const createExpenseMutation = useMutation({
    mutationFn: (payload: any) => api.createExpense(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setExpenseModalVisible(false);
      setAmount('');
      setDescription('');
      setMerchant('');
      Alert.alert('Expense Recorded', 'Your expense has been saved.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const createGoalMutation = useMutation({
    mutationFn: (payload: any) => api.createSavingsGoal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      setGoalModalVisible(false);
      setGoalName('');
      setGoalTarget('');
      setGoalCurrent('');
      Alert.alert('Goal Created', 'Your savings goal has been created.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleOpenAddExpense = () => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
    setExpenseModalVisible(true);
  };

  const handleAddExpense = () => {
    if (!amount || !description) {
      Alert.alert('Validation Error', 'Please enter amount and description');
      return;
    }

    const catId = selectedCategoryId || (categories[0]?.id ?? '');
    if (!catId) {
      Alert.alert('Validation Error', 'Please select a valid expense category');
      return;
    }

    createExpenseMutation.mutate({
      categoryId: catId,
      amount: parseFloat(amount),
      date: new Date(),
      description,
      merchant: merchant || undefined,
    });
  };

  const handleAddGoal = () => {
    if (!goalName || !goalTarget) {
      Alert.alert('Validation Error', 'Please enter goal name and target amount');
      return;
    }

    createGoalMutation.mutate({
      name: goalName,
      targetAmount: parseFloat(goalTarget),
      currentAmount: goalCurrent ? parseFloat(goalCurrent) : 0,
      color: '#10B981',
      icon: 'target',
    });
  };

  const overview = overviewData?.overview;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Wealth & Savings</Text>
            <Text style={styles.headerTitle}>Finance Engine</Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenAddExpense}
            activeOpacity={0.8}
            style={styles.addExpenseButton}
          >
            <Plus size={18} color={colors.textInverse} />
            <Text style={styles.addExpenseButtonText}>Add Expense</Text>
          </TouchableOpacity>
        </View>

        {/* 1. Big Monthly Net Savings Hero Card */}
        <View style={styles.savingsHeroCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>MONTHLY NET SAVINGS</Text>
            <View style={styles.savingsRateBadge}>
              <Text style={styles.savingsRateText}>
                {overview?.savings?.savingsRatePercentage ?? 0}% SAVINGS RATE
              </Text>
            </View>
          </View>

          <Text style={styles.netSavingsAmount}>
            {formatEUR(overview?.savings?.monthlySavings ?? 0)}
          </Text>

          <View style={styles.incomeExpenseGrid}>
            <View style={styles.incomeExpenseWell}>
              <Text style={styles.wellLabel}>Total Income (Earned)</Text>
              <Text style={styles.incomeValue}>
                {formatEUR(overview?.income?.actual ?? 0)}
              </Text>
            </View>
            <View style={styles.incomeExpenseWell}>
              <Text style={styles.wellLabel}>Total Expenses (Spent)</Text>
              <Text style={styles.expenseValue}>
                {formatEUR(overview?.expenses?.total ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Savings Goals Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <Target size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>SAVINGS GOALS</Text>
            </View>
            <TouchableOpacity onPress={() => setGoalModalVisible(true)} activeOpacity={0.7}>
              <Text style={styles.createGoalLink}>+ New Goal</Text>
            </TouchableOpacity>
          </View>

          {goalsData?.goals?.length === 0 ? (
            <View style={styles.emptyGoalCard}>
              <PiggyBank size={32} color={colors.textTertiary} />
              <Text style={styles.emptyGoalText}>No savings goals set yet.</Text>
            </View>
          ) : (
            goalsData?.goals?.map((goal: any) => (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalCardTop}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalProgressPct}>{goal.progressPercentage}%</Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(100, goal.progressPercentage)}%` },
                    ]}
                  />
                </View>

                <View style={styles.goalCardBottom}>
                  <Text style={styles.goalSavedAmount}>{formatEUR(goal.currentAmount)} saved</Text>
                  <Text style={styles.goalTargetAmount}>Target: {formatEUR(goal.targetAmount)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* 3. 6-Month Projected Wealth Forecast */}
        <View style={styles.forecastCard}>
          <View style={styles.iconHeadingRow}>
            <TrendingUp size={18} color={colors.blue} />
            <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>6-MONTH WEALTH PROJECTION</Text>
          </View>
          <Text style={styles.forecastSubtitle}>
            Estimated cumulative savings based on steady shifts and recurring costs.
          </Text>

          <View style={styles.forecastGrid}>
            {forecastData?.forecast?.projections?.slice(0, 3).map((p: any) => (
              <View key={p.monthIndex} style={styles.forecastCol}>
                <Text style={styles.forecastMonth}>Month +{p.monthIndex}</Text>
                <Text style={styles.forecastAmount}>{formatEUR(p.projectedSavings)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Add Expense Modal with Dynamic Category Selector */}
      <Modal visible={expenseModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity
                onPress={() => setExpenseModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Category Pill Selector */}
            <Text style={styles.inputLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              <View style={styles.categoryPillRow}>
                {categories.map((cat: any) => {
                  const isSelected = (selectedCategoryId || categories[0]?.id) === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategoryId(cat.id)}
                      activeOpacity={0.8}
                      style={[
                        styles.categoryPill,
                        isSelected && styles.categoryPillSelected,
                      ]}
                    >
                      <Tag size={13} color={isSelected ? colors.primaryLight : colors.textTertiary} />
                      <Text
                        style={[
                          styles.categoryPillText,
                          isSelected && styles.categoryPillTextSelected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={styles.inputLabel}>AMOUNT (€)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="25.50"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>DESCRIPTION</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Groceries / Fuel / Dining"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>MERCHANT (OPTIONAL)</Text>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Albert Heijn / Shell"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <TouchableOpacity
              onPress={handleAddExpense}
              disabled={createExpenseMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveExpenseButton}
            >
              {createExpenseMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveExpenseButtonText}>Record Expense</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Goal Modal */}
      <Modal visible={goalModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Savings Goal</Text>
              <TouchableOpacity
                onPress={() => setGoalModalVisible(false)}
                style={styles.closeButton}
              >
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
              value={goalTarget}
              onChangeText={setGoalTarget}
              keyboardType="decimal-pad"
              placeholder="5000"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>CURRENT SAVED (€)</Text>
            <TextInput
              value={goalCurrent}
              onChangeText={setGoalCurrent}
              keyboardType="decimal-pad"
              placeholder="1500"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            <TouchableOpacity
              onPress={handleAddGoal}
              disabled={createGoalMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveExpenseButton}
            >
              <Text style={styles.saveExpenseButtonText}>Create Goal</Text>
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
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addExpenseButtonText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '800',
  },

  // Savings Hero Card
  savingsHeroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 22,
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  savingsRateBadge: {
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsRateText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '800',
  },
  netSavingsAmount: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginVertical: 10,
  },
  incomeExpenseGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  incomeExpenseWell: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 12,
  },
  wellLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  incomeValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  expenseValue: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },

  // Savings Goals Section
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  createGoalLink: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyGoalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyGoalText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  goalCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 10,
  },
  goalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  goalProgressPct: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  goalCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalSavedAmount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  goalTargetAmount: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '500',
  },

  // Forecast Card
  forecastCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  forecastSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 16,
  },
  forecastGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  forecastCol: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  forecastMonth: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  forecastAmount: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
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
  categoryScroll: {
    marginBottom: 14,
  },
  categoryPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
  },
  categoryPillSelected: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  categoryPillText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryPillTextSelected: {
    color: colors.primaryLight,
    fontWeight: '700',
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
  saveExpenseButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveExpenseButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
});
