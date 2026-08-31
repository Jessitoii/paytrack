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
  User,
  Building2,
  Download,
  Upload,
  ShieldCheck,
  Percent,
  Clock,
  Sparkles,
  CheckCircle2,
  FileCode2,
  X,
} from 'lucide-react-native';
import { userRepository, exportDatabaseToJson, importDatabaseFromJson } from '../../src/database';
import { formatEUR } from '../../src/lib/formatters';
import { colors } from '../../src/theme/colors';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['localUserProfile'],
    queryFn: () => userRepository.getProfile(),
  });

  const { data: employment } = useQuery({
    queryKey: ['localEmployment'],
    queryFn: () => userRepository.getActiveEmployment(),
  });

  const { data: configs } = useQuery({
    queryKey: ['localConfigs'],
    queryFn: () => userRepository.listPayrollConfigurations(),
  });

  const exportMutation = useMutation({
    mutationFn: () => exportDatabaseToJson(),
    onSuccess: (data) => {
      const jsonStr = JSON.stringify(data, null, 2);
      Alert.alert(
        'Database Backup Created',
        `Exported ${data.workSessions.length} sessions, ${data.shifts.length} shifts, ${data.expenses.length} expenses.\n\nBackup JSON is ready.`
      );
    },
    onError: (err: any) => Alert.alert('Export Error', err.message),
  });

  const importMutation = useMutation({
    mutationFn: (jsonData: string) => {
      const parsed = JSON.parse(jsonData);
      return importDatabaseFromJson(parsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setImportModalVisible(false);
      setImportJsonText('');
      Alert.alert('Data Restored', 'Your database has been restored from backup successfully.');
    },
    onError: (err: any) => Alert.alert('Import Error', err.message || 'Invalid JSON format'),
  });

  const handleConfirmImport = () => {
    if (!importJsonText.trim()) {
      Alert.alert('Validation Error', 'Please paste the backup JSON data');
      return;
    }

    Alert.alert(
      'Confirm Restore',
      'This will replace current local data with the backup. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore Backup', style: 'destructive', onPress: () => importMutation.mutate(importJsonText.trim()) },
      ]
    );
  };

  const activeConfig = configs?.[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Personal Profile & Storage</Text>
            <Text style={styles.headerTitle}>Local Settings</Text>
          </View>
          <View style={styles.offlineBadge}>
            <ShieldCheck size={14} color={colors.primaryLight} />
            <Text style={styles.offlineBadgeText}>100% Offline</Text>
          </View>
        </View>

        {/* 1. Worker Profile Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <User size={16} color={colors.primary} />
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>WORKER PROFILE</Text>
            </View>
          </View>

          <Text style={styles.profileName}>{profile?.name || 'Worker'}</Text>
          <Text style={styles.profileEmail}>{profile?.email || 'alper@paytrack.app'}</Text>

          <View style={styles.profileDetailsRow}>
            <View style={styles.detailWell}>
              <Text style={styles.detailLabel}>Timezone</Text>
              <Text style={styles.detailValue}>{profile?.timezone || 'Europe/Amsterdam'}</Text>
            </View>
            <View style={styles.detailWell}>
              <Text style={styles.detailLabel}>Currency</Text>
              <Text style={styles.detailValue}>{profile?.currency || 'EUR (€)'}</Text>
            </View>
          </View>
        </View>

        {/* 2. Employment & Payroll Configuration */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <Building2 size={16} color={colors.blue} />
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>EMPLOYMENT & CAO RULES</Text>
            </View>
          </View>

          <Text style={styles.employerTitle}>{employment?.employerName || 'Albert Heijn B.V. Bleiswijk'}</Text>
          <Text style={styles.agencySubtitle}>Agency: {employment?.agencyName || 'Carrière Personeelsdiensten'}</Text>

          <View style={styles.rateGrid}>
            <View style={styles.rateCol}>
              <Text style={styles.rateColLabel}>Base Wage</Text>
              <Text style={styles.rateColValue}>€ {activeConfig?.baseHourlyRate ?? 14.99}/h</Text>
            </View>
            <View style={styles.rateCol}>
              <Text style={styles.rateColLabel}>ADV Rate</Text>
              <Text style={styles.rateColValue}>+€ {activeConfig?.advHourlyRate ?? 1.35}/h</Text>
            </View>
            <View style={styles.rateCol}>
              <Text style={styles.rateColLabel}>Holiday Pay</Text>
              <Text style={styles.rateColValue}>{activeConfig?.holidayAllowancePercentage ?? 8.0}%</Text>
            </View>
          </View>
        </View>

        {/* 3. Local Backup & Restore */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <FileCode2 size={16} color={colors.amber} />
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>DATABASE BACKUP & RESTORE</Text>
            </View>
          </View>

          <Text style={styles.backupHint}>
            Your entire work history, shifts, and financial records reside securely inside local SQLite on this phone.
          </Text>

          <View style={styles.backupButtonsRow}>
            <TouchableOpacity
              onPress={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              activeOpacity={0.8}
              style={styles.exportButton}
            >
              {exportMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <Download size={16} color={colors.textInverse} />
                  <Text style={styles.exportButtonText}>Export JSON</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setImportModalVisible(true)}
              activeOpacity={0.8}
              style={styles.importButton}
            >
              <Upload size={16} color={colors.textPrimary} />
              <Text style={styles.importButtonText}>Restore JSON</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Restore JSON Modal */}
      <Modal visible={importModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Restore Database</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)} style={styles.closeButton}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>PASTE BACKUP JSON DATA</Text>
            <TextInput
              value={importJsonText}
              onChangeText={setImportJsonText}
              multiline
              numberOfLines={6}
              placeholder='{"version": 1, ...}'
              placeholderTextColor={colors.textTertiary}
              style={styles.textAreaInput}
            />

            <TouchableOpacity
              onPress={handleConfirmImport}
              disabled={importMutation.isPending}
              activeOpacity={0.85}
              style={styles.confirmRestoreButton}
            >
              {importMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.confirmRestoreButtonText}>Confirm Database Restore</Text>
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
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  offlineBadgeText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  profileEmail: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 14,
  },
  profileDetailsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailWell: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  detailLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  employerTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  agencySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 14,
  },
  rateGrid: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  rateCol: {
    flex: 1,
  },
  rateColLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  rateColValue: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  backupHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 10,
  },
  backupButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 48,
    gap: 6,
  },
  exportButtonText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '800',
  },
  importButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    height: 48,
    gap: 6,
  },
  importButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
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
  textAreaInput: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 14,
    height: 120,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  confirmRestoreButton: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRestoreButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
