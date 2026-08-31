import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Clock, TrendingUp, Calendar, ArrowUpRight, ShieldCheck, LogOut } from 'lucide-react-native';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { formatEUR, formatMinutes, formatTimeHHMM, formatDateShort } from '../../src/lib/formatters';

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
  const totalPaidMinutesThisWeek = workData?.sessions?.reduce((acc: number, s: any) => acc + (s.paidMinutes || 0), 0) || 0;
  const nextShift = shiftsData?.shifts?.[0];

  const onRefresh = () => {
    refetchWork();
    refetchShifts();
    refetchFinance();
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-[#090D16]"
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={workLoading} onRefresh={onRefresh} tintColor="#10B981" />}
    >
      {/* Header with User Name and Logout button */}
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-gray-400 text-sm font-medium">Welcome back, {user?.name || 'Worker'}</Text>
          <Text className="text-white text-2xl font-bold">PayTrack</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full flex-row items-center">
            <ShieldCheck size={16} color="#10B981" />
            <Text className="text-emerald-400 text-xs font-semibold ml-1.5">AH / Carrière</Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            className="w-9 h-9 rounded-full bg-card border border-cardBorder items-center justify-center"
          >
            <LogOut size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Work Session Banner / Quick Punch */}
      {activeSession ? (
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/work')}
          className="bg-emerald-950/60 border-2 border-emerald-500 rounded-2xl p-5 mb-6 shadow-lg shadow-emerald-500/20"
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse mr-2" />
              <Text className="text-emerald-300 font-bold uppercase tracking-wider text-xs">Work In Progress</Text>
            </View>
            <ArrowUpRight size={18} color="#34D399" />
          </View>
          <Text className="text-white text-2xl font-extrabold mt-2">
            Started at {formatTimeHHMM(activeSession.actualStart)}
          </Text>
          <Text className="text-emerald-400/80 text-xs mt-1">Tap to select breaks or finish session with 5-min rounding</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/work')}
          className="bg-card border border-cardBorder rounded-2xl p-5 mb-6 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-xl bg-emerald-500/10 items-center justify-center mr-4">
              <Clock size={24} color="#10B981" />
            </View>
            <View>
              <Text className="text-white font-bold text-base">Ready to Work?</Text>
              <Text className="text-gray-400 text-xs mt-0.5">1-Tap Start Work timestamp recording</Text>
            </View>
          </View>
          <View className="bg-emerald-500 px-4 py-2 rounded-xl">
            <Text className="text-gray-950 font-bold text-xs">START</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Weekly Payroll Summary Card (Live Calculated from Work Sessions) */}
      <View className="bg-card border border-cardBorder rounded-3xl p-6 mb-6 shadow-sm">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider">This Week's Estimate</Text>
          <Text className="text-emerald-400 font-semibold text-xs">{formatMinutes(totalPaidMinutesThisWeek)} Worked</Text>
        </View>

        <View className="flex-row items-baseline mb-4">
          <Text className="text-white text-4xl font-extrabold">
            {formatEUR((totalPaidMinutesThisWeek / 60) * 16.34)}
          </Text>
          <Text className="text-gray-400 text-sm font-medium ml-2">estimated gross</Text>
        </View>

        <View className="h-px bg-gray-800 my-3" />

        <View className="flex-row justify-between">
          <View>
            <Text className="text-gray-500 text-xs">Base Rate</Text>
            <Text className="text-gray-200 text-sm font-bold mt-0.5">€ 14,99/hr</Text>
          </View>
          <View>
            <Text className="text-gray-500 text-xs">ADV Allowance</Text>
            <Text className="text-gray-200 text-sm font-bold mt-0.5">+€ 1,35/hr</Text>
          </View>
          <View>
            <Text className="text-gray-500 text-xs">Holiday Pay</Text>
            <Text className="text-gray-200 text-sm font-bold mt-0.5">8,00%</Text>
          </View>
        </View>
      </View>

      {/* Monthly Finance Card */}
      <View className="bg-card border border-cardBorder rounded-3xl p-6 mb-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Monthly Overview</Text>
          <TrendingUp size={16} color="#10B981" />
        </View>

        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-gray-400 text-xs">Monthly Savings</Text>
            <Text className="text-white text-2xl font-bold mt-0.5">
              {formatEUR(financeData?.overview?.savings?.monthlySavings ?? 0)}
            </Text>
          </View>
          <View className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
            <Text className="text-emerald-400 font-extrabold text-sm">
              {financeData?.overview?.savings?.savingsRatePercentage ?? 0}% Rate
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between bg-[#0B0F19] rounded-2xl p-3.5 border border-gray-800/80">
          <View>
            <Text className="text-gray-500 text-xs">Income (Received)</Text>
            <Text className="text-gray-200 text-sm font-bold mt-0.5">
              {formatEUR(financeData?.overview?.income?.actual ?? 0)}
            </Text>
          </View>
          <View className="w-px bg-gray-800" />
          <View>
            <Text className="text-gray-500 text-xs">Expenses (Spent)</Text>
            <Text className="text-rose-400 text-sm font-bold mt-0.5">
              {formatEUR(financeData?.overview?.expenses?.total ?? 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Upcoming Next Shift */}
      <View className="bg-card border border-cardBorder rounded-3xl p-6">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Next Planned Shift</Text>
          <Calendar size={16} color="#9CA3AF" />
        </View>

        {nextShift ? (
          <View className="flex-row items-center justify-between mt-1">
            <View>
              <Text className="text-white text-base font-bold">
                {nextShift.shiftType} Shift
              </Text>
              <Text className="text-gray-400 text-xs mt-0.5">
                {formatDateShort(nextShift.date)} • {formatTimeHHMM(nextShift.plannedStart)} – {formatTimeHHMM(nextShift.plannedEnd)}
              </Text>
            </View>
            <View className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              <Text className="text-blue-400 text-xs font-bold">{nextShift.shiftType}</Text>
            </View>
          </View>
        ) : (
          <Text className="text-gray-500 text-sm mt-1">No shifts planned for this week.</Text>
        )}
      </View>
    </ScrollView>
  );
}
