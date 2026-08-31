import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Plus, TrendingUp, Target, ArrowUpRight, DollarSign, X } from 'lucide-react-native';
import { api } from '../../src/services/api.js';
import { formatEUR } from '../../src/lib/formatters.js';

export default function FinanceScreen() {
  const queryClient = useQueryClient();
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);

  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');

  const { data: overviewData } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.getOverview(),
  });

  const { data: expensesData } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.listExpenses(),
  });

  const { data: goalsData } = useQuery({
    queryKey: ['savingsGoals'],
    queryFn: () => api.listSavingsGoals(),
  });

  const { data: forecastData } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.getForecast(6),
  });

  const createExpenseMutation = useMutation({
    mutationFn: (payload: any) => api.createExpense(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setExpenseModalVisible(false);
      setAmount('');
      setDescription('');
      setMerchant('');
      Alert.alert('Expense Added', 'Your expense has been saved.');
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

  const handleAddExpense = () => {
    if (!amount || !description) {
      Alert.alert('Validation Error', 'Please enter amount and description');
      return;
    }

    createExpenseMutation.mutate({
      categoryId: 'default', // Auto assigned or first category
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
    <View className="flex-1 bg-[#090D16]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-gray-400 text-sm font-medium">Wealth & Savings</Text>
            <Text className="text-white text-3xl font-extrabold">Finance Engine</Text>
          </View>
          <TouchableOpacity
            onPress={() => setExpenseModalVisible(true)}
            className="bg-emerald-500 w-11 h-11 rounded-2xl items-center justify-center shadow-lg shadow-emerald-500/20"
          >
            <Plus size={22} color="#090D16" />
          </TouchableOpacity>
        </View>

        {/* Big Savings Overview Card */}
        <View className="bg-card border border-cardBorder rounded-3xl p-6 mb-6 shadow-xl">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Monthly Net Savings</Text>
            <View className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
              <Text className="text-emerald-400 font-extrabold text-xs">
                {overview?.savings?.savingsRatePercentage ?? 0}% SAVINGS RATE
              </Text>
            </View>
          </View>

          <Text className="text-white text-4xl font-extrabold mb-4">
            {formatEUR(overview?.savings?.monthlySavings ?? 0)}
          </Text>

          <View className="flex-row gap-3">
            <View className="flex-1 bg-[#0B0F19] border border-gray-800 rounded-2xl p-3.5">
              <Text className="text-gray-500 text-xs">Total Income</Text>
              <Text className="text-gray-200 text-base font-bold mt-0.5">
                {formatEUR(overview?.income?.actual ?? 0)}
              </Text>
            </View>

            <View className="flex-1 bg-[#0B0F19] border border-gray-800 rounded-2xl p-3.5">
              <Text className="text-gray-500 text-xs">Total Expenses</Text>
              <Text className="text-rose-400 text-base font-bold mt-0.5">
                {formatEUR(overview?.expenses?.total ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Savings Goals Section */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center">
              <Target size={18} color="#10B981" />
              <Text className="text-white font-bold text-lg ml-2">Savings Goals</Text>
            </View>
            <TouchableOpacity onPress={() => setGoalModalVisible(true)}>
              <Text className="text-emerald-400 text-xs font-bold">+ New Goal</Text>
            </TouchableOpacity>
          </View>

          {goalsData?.goals?.length === 0 ? (
            <View className="bg-card border border-cardBorder rounded-2xl p-5 items-center">
              <Text className="text-gray-500 text-sm">No savings goals created yet.</Text>
            </View>
          ) : (
            goalsData?.goals?.map((goal: any) => (
              <View key={goal.id} className="bg-card border border-cardBorder rounded-2xl p-5 mb-3">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-white font-bold text-base">{goal.name}</Text>
                  <Text className="text-emerald-400 font-extrabold text-sm">{goal.progressPercentage}%</Text>
                </View>

                {/* Progress Bar */}
                <View className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden mb-2">
                  <View
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, goal.progressPercentage)}%` }}
                  />
                </View>

                <View className="flex-row justify-between text-xs">
                  <Text className="text-gray-400 text-xs">{formatEUR(goal.currentAmount)} saved</Text>
                  <Text className="text-gray-500 text-xs">Target: {formatEUR(goal.targetAmount)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* 6-Month Projection Forecast */}
        <View className="bg-card border border-cardBorder rounded-3xl p-6">
          <View className="flex-row items-center mb-3">
            <TrendingUp size={18} color="#3B82F6" />
            <Text className="text-white font-bold text-lg ml-2">6-Month Savings Forecast</Text>
          </View>
          <Text className="text-gray-400 text-xs mb-4">
            Projected cumulative savings based on current income and recurring expenses.
          </Text>

          <View className="flex-row justify-between">
            {forecastData?.forecast?.projections?.slice(0, 3).map((p: any) => (
              <View key={p.monthIndex} className="bg-[#0B0F19] border border-gray-800 rounded-2xl p-3.5 flex-1 mx-1 items-center">
                <Text className="text-gray-500 text-xs">Month +{p.monthIndex}</Text>
                <Text className="text-white font-extrabold text-sm mt-1">{formatEUR(p.projectedSavings)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal visible={expenseModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-card border-t border-cardBorder rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">Add New Expense</Text>
              <TouchableOpacity onPress={() => setExpenseModalVisible(false)}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Amount (€)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="25.50"
              placeholderTextColor="#64748B"
              className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 text-white text-lg font-bold mb-4"
            />

            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Groceries / Dining / Fuel"
              placeholderTextColor="#64748B"
              className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 text-white text-base mb-4"
            />

            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Merchant (Optional)</Text>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Albert Heijn / Shell"
              placeholderTextColor="#64748B"
              className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 text-white text-base mb-6"
            />

            <TouchableOpacity
              onPress={handleAddExpense}
              disabled={createExpenseMutation.isPending}
              className="bg-emerald-500 py-4 rounded-xl items-center"
            >
              <Text className="text-gray-950 font-bold text-base">Save Expense</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Goal Modal */}
      <Modal visible={goalModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-card border-t border-cardBorder rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">New Savings Goal</Text>
              <TouchableOpacity onPress={() => setGoalModalVisible(false)}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Goal Name</Text>
            <TextInput
              value={goalName}
              onChangeText={setGoalName}
              placeholder="e.g. Emergency Fund / Vacation"
              placeholderTextColor="#64748B"
              className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 text-white text-base mb-4"
            />

            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Target Amount (€)</Text>
            <TextInput
              value={goalTarget}
              onChangeText={setGoalTarget}
              keyboardType="decimal-pad"
              placeholder="5000"
              placeholderTextColor="#64748B"
              className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 text-white text-lg font-bold mb-4"
            />

            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Current Saved (€)</Text>
            <TextInput
              value={goalCurrent}
              onChangeText={setGoalCurrent}
              keyboardType="decimal-pad"
              placeholder="1000"
              placeholderTextColor="#64748B"
              className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 text-white text-base mb-6"
            />

            <TouchableOpacity
              onPress={handleAddGoal}
              disabled={createGoalMutation.isPending}
              className="bg-emerald-500 py-4 rounded-xl items-center"
            >
              <Text className="text-gray-950 font-bold text-base">Create Goal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
