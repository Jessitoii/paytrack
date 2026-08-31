import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, Coffee, Utensils, CheckCircle2, History, AlertCircle } from 'lucide-react-native';
import { api } from '../../src/services/api.js';
import { formatMinutes, formatTimeHHMM, formatDateShort } from '../../src/lib/formatters.js';
import { roundFinishDateTo5Minutes } from '../../shared/time/rounding.js';

export default function WorkTrackingScreen() {
  const queryClient = useQueryClient();
  const [selectedBreaks, setSelectedBreaks] = useState<Array<{ type: string; durationMinutes: number; isPaid: boolean; name: string }>>([
    { type: 'PAID_15', durationMinutes: 15, isPaid: true, name: 'Paid coffee (15m)' },
    { type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Unpaid lunch (30m)' },
  ]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: workData, isLoading } = useQuery({
    queryKey: ['workSessions'],
    queryFn: () => api.listWorkSessions(),
  });

  const activeSession = workData?.sessions?.find((s: any) => s.status === 'WORKING');
  const pastSessions = workData?.sessions?.filter((s: any) => s.status === 'COMPLETED') || [];

  const startMutation = useMutation({
    mutationFn: () => api.startWork(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
      Alert.alert('Session Started', 'Your shift has been recorded.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const finishMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api.finishWork(sessionId, {
        rawFinish: new Date(),
        breaks: selectedBreaks,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workSessions'] });
      Alert.alert(
        'Shift Completed',
        `Rounded to ${formatTimeHHMM(data.session.roundedFinish)} (5-min upward ceiling)\nPaid Hours: ${formatMinutes(data.calculation.paidMinutes)}`
      );
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const toggleBreak = (type: string, duration: number, isPaid: boolean, name: string) => {
    const exists = selectedBreaks.some((b) => b.type === type);
    if (exists) {
      setSelectedBreaks(selectedBreaks.filter((b) => b.type !== type));
    } else {
      setSelectedBreaks([...selectedBreaks, { type, durationMinutes: duration, isPaid, name }]);
    }
  };

  const previewRoundedTime = roundFinishDateTo5Minutes(currentTime);

  return (
    <ScrollView className="flex-1 bg-[#090D16]" contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      {/* Header */}
      <View className="mb-6">
        <Text className="text-gray-400 text-sm font-medium">Shift & Time Tracker</Text>
        <Text className="text-white text-3xl font-extrabold">1-Tap Punch</Text>
      </View>

      {/* Main Punch Clock Card */}
      <View className="bg-card border border-cardBorder rounded-3xl p-6 mb-6 items-center shadow-xl">
        <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Live Clock</Text>
        <Text className="text-white text-5xl font-extrabold tracking-tight mb-2">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>

        {activeSession ? (
          <View className="items-center mt-2 mb-6">
            <View className="bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-full flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2" />
              <Text className="text-emerald-400 text-xs font-bold">WORKING SINCE {formatTimeHHMM(activeSession.actualStart)}</Text>
            </View>

            {/* 5-minute upward rounding preview */}
            <View className="bg-[#0B0F19] border border-gray-800 rounded-2xl p-4 mt-5 w-full">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-400 text-xs font-medium">Raw Finish</Text>
                <Text className="text-gray-200 text-sm font-bold">{formatTimeHHMM(currentTime)}</Text>
              </View>
              <View className="h-px bg-gray-800 my-2" />
              <View className="flex-row justify-between items-center">
                <Text className="text-emerald-400 text-xs font-semibold">Rounded Finish (5-Min Ceiling)</Text>
                <Text className="text-emerald-400 text-base font-extrabold">{formatTimeHHMM(previewRoundedTime)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text className="text-gray-400 text-sm mt-1 mb-6">No shift currently active</Text>
        )}

        {/* Break Selector (when finishing) */}
        {activeSession && (
          <View className="w-full mb-6">
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Shift Breaks Taken</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => toggleBreak('PAID_15', 15, true, 'Paid coffee (15m)')}
                className={`flex-1 p-3.5 rounded-2xl border flex-row items-center justify-center ${
                  selectedBreaks.some((b) => b.type === 'PAID_15')
                    ? 'bg-emerald-500/20 border-emerald-500'
                    : 'bg-[#0B0F19] border-gray-800'
                }`}
              >
                <Coffee size={16} color={selectedBreaks.some((b) => b.type === 'PAID_15') ? '#10B981' : '#9CA3AF'} />
                <Text className={`text-xs font-bold ml-2 ${selectedBreaks.some((b) => b.type === 'PAID_15') ? 'text-emerald-400' : 'text-gray-400'}`}>
                  Paid 15m
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => toggleBreak('UNPAID_30', 30, false, 'Unpaid lunch (30m)')}
                className={`flex-1 p-3.5 rounded-2xl border flex-row items-center justify-center ${
                  selectedBreaks.some((b) => b.type === 'UNPAID_30')
                    ? 'bg-emerald-500/20 border-emerald-500'
                    : 'bg-[#0B0F19] border-gray-800'
                }`}
              >
                <Utensils size={16} color={selectedBreaks.some((b) => b.type === 'UNPAID_30') ? '#10B981' : '#9CA3AF'} />
                <Text className={`text-xs font-bold ml-2 ${selectedBreaks.some((b) => b.type === 'UNPAID_30') ? 'text-emerald-400' : 'text-gray-400'}`}>
                  Lunch 30m
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Big Tactile Punch Button */}
        {activeSession ? (
          <TouchableOpacity
            onPress={() => finishMutation.mutate(activeSession.id)}
            disabled={finishMutation.isPending}
            className="w-full bg-rose-600 active:bg-rose-700 py-5 rounded-2xl items-center flex-row justify-center shadow-lg shadow-rose-600/30"
          >
            {finishMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Square size={20} color="#FFFFFF" fill="#FFFFFF" />
                <Text className="text-white text-base font-extrabold ml-2">FINISH WORK</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="w-full bg-emerald-500 active:bg-emerald-600 py-5 rounded-2xl items-center flex-row justify-center shadow-lg shadow-emerald-500/30"
          >
            {startMutation.isPending ? (
              <ActivityIndicator color="#090D16" />
            ) : (
              <>
                <Play size={20} color="#090D16" fill="#090D16" />
                <Text className="text-gray-950 text-base font-extrabold ml-2">START WORK</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Shift History Section */}
      <View className="mt-2">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <History size={18} color="#9CA3AF" />
            <Text className="text-white font-bold text-lg ml-2">Recent Shifts</Text>
          </View>
          <Text className="text-gray-500 text-xs">{pastSessions.length} completed</Text>
        </View>

        {pastSessions.length === 0 ? (
          <View className="bg-card border border-cardBorder rounded-2xl p-6 items-center">
            <Text className="text-gray-500 text-sm">No completed shifts yet.</Text>
          </View>
        ) : (
          pastSessions.map((session: any) => (
            <View key={session.id} className="bg-card border border-cardBorder rounded-2xl p-5 mb-3">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-white font-bold text-base">{formatDateShort(session.actualStart)}</Text>
                <View className="bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                  <Text className="text-emerald-400 font-extrabold text-xs">{formatMinutes(session.paidMinutes)}</Text>
                </View>
              </View>

              <View className="flex-row justify-between items-center text-xs">
                <Text className="text-gray-400 text-xs">
                  {formatTimeHHMM(session.actualStart)} – {formatTimeHHMM(session.roundedFinish)} (raw {formatTimeHHMM(session.rawFinish)})
                </Text>
                <Text className="text-gray-500 text-xs">
                  {session.breaks?.length || 0} breaks
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
