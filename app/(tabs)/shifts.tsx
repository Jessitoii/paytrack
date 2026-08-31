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
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Sun,
  Sunset,
  Moon,
  Coffee,
  X,
  Clock,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { formatDateShort, formatTimeHHMM } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

const SHIFT_TYPES = [
  { type: 'MORNING', label: 'Morning', icon: Sun, color: colors.amber, time: '06:00 - 15:00' },
  { type: 'AFTERNOON', label: 'Afternoon', icon: Sunset, color: colors.blue, time: '14:30 - 23:00' },
  { type: 'NIGHT', label: 'Night', icon: Moon, color: colors.indigo, time: '22:30 - 07:00' },
  { type: 'OFF', label: 'Day Off', icon: Coffee, color: colors.primary, time: 'Rest day' },
];

export default function ShiftsScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [shiftType, setShiftType] = useState('AFTERNOON');
  const [dateStr, setDateStr] = useState(new Date().toISOString().substring(0, 10));
  const [startTime, setStartTime] = useState('14:30');
  const [endTime, setEndTime] = useState('23:00');
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
      Alert.alert('Shift Added', 'Your shift has been scheduled.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => api.deleteShift(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleCreateShift = () => {
    const isDayOff = shiftType === 'OFF';
    const baseDate = new Date(dateStr);

    let plannedStart: Date | undefined;
    let plannedEnd: Date | undefined;

    if (!isDayOff) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);

      plannedStart = new Date(baseDate);
      plannedStart.setHours(sh || 14, sm || 30, 0, 0);

      plannedEnd = new Date(baseDate);
      plannedEnd.setHours(eh || 23, em || 0, 0, 0);

      if (eh < sh) {
        plannedEnd.setDate(plannedEnd.getDate() + 1);
      }
    }

    createShiftMutation.mutate({
      date: baseDate,
      shiftType,
      plannedStart,
      plannedEnd,
      isDayOff,
      notes: notes || undefined,
    });
  };

  const shifts = shiftsData?.shifts || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Weekly Schedule</Text>
            <Text style={styles.headerTitle}>Planned Shifts</Text>
          </View>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            style={styles.addButton}
          >
            <Plus size={20} color={colors.textInverse} />
            <Text style={styles.addButtonText}>New Shift</Text>
          </TouchableOpacity>
        </View>

        {/* Shifts List */}
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : shifts.length === 0 ? (
          <View style={styles.emptyCard}>
            <CalendarIcon size={36} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Shifts Scheduled</Text>
            <Text style={styles.emptySubtitle}>
              Tap "+ New Shift" to plan your upcoming work week.
            </Text>
          </View>
        ) : (
          shifts.map((shift: any) => {
            const shiftConfig =
              SHIFT_TYPES.find((t) => t.type === shift.shiftType) || SHIFT_TYPES[1];
            const Icon = shiftConfig.icon;

            return (
              <View key={shift.id} style={styles.shiftCard}>
                <View style={styles.shiftLeftCol}>
                  <View
                    style={[
                      styles.iconBadge,
                      {
                        backgroundColor: `${shiftConfig.color}20`,
                        borderColor: `${shiftConfig.color}40`,
                      },
                    ]}
                  >
                    <Icon size={20} color={shiftConfig.color} />
                  </View>
                  <View style={styles.shiftInfo}>
                    <View style={styles.shiftTypeRow}>
                      <Text style={styles.shiftTypeText}>{shiftConfig.label}</Text>
                      <View
                        style={[
                          styles.typePill,
                          {
                            backgroundColor: `${shiftConfig.color}15`,
                            borderColor: `${shiftConfig.color}30`,
                          },
                        ]}
                      >
                        <Text style={[styles.typePillText, { color: shiftConfig.color }]}>
                          {shift.shiftType}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.shiftDateText}>{formatDateShort(shift.date)}</Text>

                    {!shift.isDayOff && shift.plannedStart && (
                      <View style={styles.timeRow}>
                        <Clock size={12} color={colors.textSecondary} />
                        <Text style={styles.shiftHoursText}>
                          {formatTimeHHMM(shift.plannedStart)} – {formatTimeHHMM(shift.plannedEnd)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => deleteShiftMutation.mutate(shift.id)}
                  activeOpacity={0.7}
                  style={styles.deleteButton}
                >
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Shift Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Plan New Shift</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Shift Type Pills */}
            <Text style={styles.inputLabel}>SELECT SHIFT TYPE</Text>
            <View style={styles.shiftTypeSelector}>
              {SHIFT_TYPES.map((t) => {
                const isSelected = shiftType === t.type;
                return (
                  <TouchableOpacity
                    key={t.type}
                    onPress={() => {
                      setShiftType(t.type);
                      if (t.type === 'MORNING') {
                        setStartTime('06:00');
                        setEndTime('15:00');
                      } else if (t.type === 'AFTERNOON') {
                        setStartTime('14:30');
                        setEndTime('23:00');
                      } else if (t.type === 'NIGHT') {
                        setStartTime('22:30');
                        setEndTime('07:00');
                      }
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.typeOption,
                      isSelected && {
                        borderColor: t.color,
                        backgroundColor: `${t.color}20`,
                      },
                    ]}
                  >
                    <t.icon size={16} color={isSelected ? t.color : colors.textTertiary} />
                    <Text
                      style={[
                        styles.typeOptionText,
                        isSelected && { color: t.color, fontWeight: '800' },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date Input */}
            <Text style={styles.inputLabel}>DATE (YYYY-MM-DD)</Text>
            <TextInput
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="2026-08-24"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            {shiftType !== 'OFF' && (
              <View style={styles.timeInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>START TIME</Text>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="14:30"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>END TIME</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="23:00"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.textInput}
                  />
                </View>
              </View>
            )}

            {/* Notes */}
            <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Department / Position"
              placeholderTextColor={colors.textTertiary}
              style={styles.textInput}
            />

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleCreateShift}
              disabled={createShiftMutation.isPending}
              activeOpacity={0.85}
              style={styles.saveShiftButton}
            >
              {createShiftMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveShiftButtonText}>Schedule Shift</Text>
              )}
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 36,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },

  // Shift Card
  shiftCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  shiftInfo: {
    flex: 1,
  },
  shiftTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftTypeText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  typePill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  shiftDateText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  shiftHoursText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 20,
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
  shiftTypeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 4,
  },
  typeOptionText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
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
  timeInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveShiftButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveShiftButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
});
