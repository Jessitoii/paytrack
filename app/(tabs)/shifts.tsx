import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus, Trash2, Sun, Sunset, Moon, Coffee, X } from 'lucide-react-native';
import { api } from '../../src/services/api.js';
import { formatDateShort, formatTimeHHMM } from '../../src/lib/formatters.js';

export default function ShiftsScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<'MORNING' | 'AFTERNOON' | 'NIGHT' | 'OFF'>('MORNING');
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().substring(0, 10));
  const [notes, setNotes] = useState('');

  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => api.listShifts(),
  });

  const createShiftMutation = useMutation({
    mutationFn: (payload: any) => api.createShift(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setModalVisible(false);
      setNotes('');
      Alert.alert('Shift Added', 'Your planned shift has been saved.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => api.deleteShift(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });

  const handleCreateShift = () => {
    let plannedStart: Date | undefined;
    let plannedEnd: Date | undefined;

    if (selectedType === 'MORNING') {
      plannedStart = new Date(`${shiftDate}T06:00:00`);
      plannedEnd = new Date(`${shiftDate}T14:30:00`);
    } else if (selectedType === 'AFTERNOON') {
      plannedStart = new Date(`${shiftDate}T14:30:00`);
      plannedEnd = new Date(`${shiftDate}T23:00:00`);
    } else if (selectedType === 'NIGHT') {
      plannedStart = new Date(`${shiftDate}T23:00:00`);
      const nextDay = new Date(new Date(shiftDate).getTime() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      plannedEnd = new Date(`${nextDay}T06:00:00`);
    }

    createShiftMutation.mutate({
      date: new Date(shiftDate),
      shiftType: selectedType,
      plannedStart,
      plannedEnd,
      isDayOff: selectedType === 'OFF',
      notes: notes || undefined,
    });
  };

  const getShiftIcon = (type: string) => {
    switch (type) {
      case 'MORNING':
        return <Sun size={20} color="#F59E0B" />;
      case 'AFTERNOON':
        return <Sunset size={20} color="#3B82F6" />;
      case 'NIGHT':
        return <Moon size={20} color="#8B5CF6" />;
      default:
        return <Coffee size={20} color="#10B981" />;
    }
  };

  return (
    <View className="flex-1 bg-[#090D16]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-gray-400 text-sm font-medium">Work Schedule</Text>
            <Text className="text-white text-3xl font-extrabold">Shift Planner</Text>
          </View>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="bg-emerald-500 w-11 h-11 rounded-2xl items-center justify-center shadow-lg shadow-emerald-500/20"
          >
            <Plus size={22} color="#090D16" />
          </TouchableOpacity>
        </View>

        {/* Shifts List */}
        {shiftsData?.shifts?.length === 0 ? (
          <View className="bg-card border border-cardBorder rounded-3xl p-8 items-center mt-4">
            <Calendar size={36} color="#64748B" />
            <Text className="text-white font-bold text-base mt-4">No Shifts Scheduled</Text>
            <Text className="text-gray-400 text-xs text-center mt-1">Tap the plus button to add morning, afternoon, or night shifts.</Text>
          </View>
        ) : (
          shiftsData?.shifts?.map((shift: any) => (
            <View key={shift.id} className="bg-card border border-cardBorder rounded-2xl p-5 mb-3 flex-row justify-between items-center">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-2xl bg-[#0B0F19] border border-gray-800 items-center justify-center mr-4">
                  {getShiftIcon(shift.shiftType)}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-white font-bold text-base mr-2">{shift.shiftType} Shift</Text>
                    {shift.isDayOff && (
                      <View className="bg-emerald-500/10 px-2 py-0.5 rounded">
                        <Text className="text-emerald-400 text-[10px] font-bold">DAY OFF</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-gray-400 text-xs mt-0.5">
                    {formatDateShort(shift.date)} {shift.plannedStart ? `• ${formatTimeHHMM(shift.plannedStart)} – ${formatTimeHHMM(shift.plannedEnd)}` : ''}
                  </Text>
                  {shift.notes && <Text className="text-gray-500 text-xs mt-1 italic">{shift.notes}</Text>}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => deleteShiftMutation.mutate(shift.id)}
                className="p-2.5 rounded-xl bg-rose-500/10 ml-2"
              >
                <Trash2 size={16} color="#F43F5E" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Shift Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-card border-t border-cardBorder rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">Add Planned Shift</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Shift Type Picker */}
            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Shift Type</Text>
            <View className="flex-row gap-2 mb-4">
              {(['MORNING', 'AFTERNOON', 'NIGHT', 'OFF'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setSelectedType(type)}
                  className={`flex-1 py-3 rounded-xl border items-center ${
                    selectedType === type ? 'bg-emerald-500/20 border-emerald-500' : 'bg-[#0B0F19] border-gray-800'
                  }`}
                >
                  <Text className={`text-xs font-bold ${selectedType === type ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Input */}
            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Date (YYYY-MM-DD)</Text>
            <TextInput
              value={shiftDate}
              onChangeText={setShiftDate}
              placeholder="2026-08-24"
              placeholderTextColor="#64748B"
              className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 text-white text-base mb-4"
            />

            {/* Notes */}
            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Notes (Optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Gate 3 / Inbound team"
              placeholderTextColor="#64748B"
              className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 text-white text-base mb-6"
            />

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleCreateShift}
              disabled={createShiftMutation.isPending}
              className="bg-emerald-500 py-4 rounded-xl items-center"
            >
              <Text className="text-gray-950 font-bold text-base">Save Shift</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
