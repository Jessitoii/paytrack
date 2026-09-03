import React, { useState } from 'react';
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
  Share,
  Switch,
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
  Edit3,
  AlertTriangle,
  Tag,
  Plus,
  Trash2,
  RotateCcw,
  Sliders,
  DollarSign,
  Briefcase,
  MapPin,
  Layers,
  ArrowUp,
  ArrowDown,
  Cloud,
  Lock,
  ExternalLink,
  RefreshCw,
  Key,
  LogOut,
  UploadCloud,
  DownloadCloud,
} from 'lucide-react-native';
import {
  userRepository,
  financeRepository,
  exportDatabaseToJson,
  importDatabaseFromJson,
} from '../../src/database';
import {
  loginWithGoogle,
  clearAuthSession,
  getSecureItem,
  setSecureItem,
  SECURE_KEYS,
  executeCloudBackup,
  restoreFromCloud,
} from '../../src/services';
import { useDatabaseRefresh } from '../../src/hooks/useDatabaseRefresh';
import { formatEUR } from '../../src/lib/formatters';
import { useTheme, ThemeMode } from '../../src/theme/ThemeContext';
import { useNotification } from '../../src/components/NotificationContext';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { showSuccess, showError, showWarning, confirm } = useNotification();

  // Modals State
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [employmentModalVisible, setEmploymentModalVisible] = useState(false);
  const [payrollModalVisible, setPayrollModalVisible] = useState(false);
  const [manageCategoriesModalVisible, setManageCategoriesModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [cloudInfoModalVisible, setCloudInfoModalVisible] = useState(false);
  const [exportedJsonText, setExportedJsonText] = useState('');
  const [importJsonText, setImportJsonText] = useState('');

  // Cloud Backup State
  const [cloudPasswordModalVisible, setCloudPasswordModalVisible] = useState(false);
  const [cloudRestoreModalVisible, setCloudRestoreModalVisible] = useState(false);
  const [cloudPasswordInput, setCloudPasswordInput] = useState('');
  const [cloudPasswordConfirmInput, setCloudPasswordConfirmInput] = useState('');
  const [cloudRestorePasswordInput, setCloudRestorePasswordInput] = useState('');

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCurrency, setEditCurrency] = useState('EUR');
  const [editTimezone, setEditTimezone] = useState('Europe/Amsterdam');
  const [editInitialSavings, setEditInitialSavings] = useState('1500');

  // Employment Edit State
  const [editEmployer, setEditEmployer] = useState('');
  const [editAgency, setEditAgency] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // Payroll Config Edit State
  const [editBaseRate, setEditBaseRate] = useState('14.99');
  const [editAdvRate, setEditAdvRate] = useState('1.35');
  const [editHolidayPct, setEditHolidayPct] = useState('8.0');
  const [editHealthWeekly, setEditHealthWeekly] = useState('35.40');
  const [editAddInsurance, setEditAddInsurance] = useState('0.00');
  const [editTaxRate, setEditTaxRate] = useState('17.5');

  // Category Add / Edit State
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryColorInput, setCategoryColorInput] = useState('#10B981');
  const [categoryIconInput, setCategoryIconInput] = useState('tag');
  const [categoryActiveInput, setCategoryActiveInput] = useState(true);

  // Queries
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['localUserProfile'],
    queryFn: () => userRepository.getProfile(),
  });

  const { data: employment, refetch: refetchEmployment } = useQuery({
    queryKey: ['localEmployment'],
    queryFn: () => userRepository.getActiveEmployment(),
  });

  const { data: configs, refetch: refetchConfigs } = useQuery({
    queryKey: ['localConfigs'],
    queryFn: () => userRepository.listPayrollConfigurations(),
  });

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ['localExpenseCategories'],
    queryFn: () => financeRepository.listCategories(false),
  });

  const { data: allCategories, refetch: refetchAllCategories } = useQuery({
    queryKey: ['localAllExpenseCategories'],
    queryFn: () => financeRepository.listCategories(true),
  });

  const { data: cloudAuthData, refetch: refetchCloudAuth } = useQuery({
    queryKey: ['cloudAuthData'],
    queryFn: async () => {
      const userEmail = await getSecureItem(SECURE_KEYS.USER_EMAIL);
      const hasToken = !!(await getSecureItem(SECURE_KEYS.ACCESS_TOKEN));
      const hasPassword = !!(await getSecureItem(SECURE_KEYS.BACKUP_PASSWORD));
      const syncStatus = await userRepository.getSetting('cloud_backup_status', hasToken ? 'connected' : 'not_connected');
      const lastBackupAt = await userRepository.getSetting('last_cloud_backup_at', '');
      const lastError = await userRepository.getSetting('last_cloud_backup_error', '');

      return {
        isConnected: hasToken,
        userEmail: userEmail || 'Connected Google Account',
        hasPassword,
        syncStatus,
        lastBackupAt,
        lastError,
      };
    },
  });

  useDatabaseRefresh(['settings_changed', 'finance_changed'], () => {
    refetchProfile();
    refetchEmployment();
    refetchConfigs();
    refetchCategories();
    refetchAllCategories();
    refetchCloudAuth();
  });

  const activeConfig = configs?.[0];

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => userRepository.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localUserProfile'] });
      setProfileModalVisible(false);
      showSuccess('Profile Saved', 'Your profile details have been updated.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const updateEmploymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => userRepository.updateEmployment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localEmployment'] });
      setEmploymentModalVisible(false);
      showSuccess('Employment Saved', 'Your workplace information has been updated.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const updatePayrollMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => userRepository.updatePayrollConfiguration(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localConfigs'] });
      setPayrollModalVisible(false);
      showSuccess('Payroll Saved', 'New payroll parameters updated for wage estimations.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => financeRepository.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localExpenseCategories'] });
      queryClient.invalidateQueries({ queryKey: ['localAllExpenseCategories'] });
      setCategoryModalVisible(false);
      setCategoryNameInput('');
      showSuccess('Category Created', 'New category added.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => financeRepository.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localExpenseCategories'] });
      queryClient.invalidateQueries({ queryKey: ['localAllExpenseCategories'] });
      setCategoryModalVisible(false);
      setEditingCategory(null);
      showSuccess('Category Saved', 'Category details updated.');
    },
    onError: (err: any) => showError('Error', err.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => financeRepository.deleteCategory(id),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['localExpenseCategories'] });
      queryClient.invalidateQueries({ queryKey: ['localAllExpenseCategories'] });
      if (res.softDeleted) {
        showWarning('Category Deactivated', res.message || 'Category set to inactive because historical expenses are linked to it.');
      } else {
        showSuccess('Category Deleted', 'Category permanently removed.');
      }
    },
    onError: (err: any) => showError('Delete Error', err.message),
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: (ids: string[]) => financeRepository.reorderCategories(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localExpenseCategories'] });
      queryClient.invalidateQueries({ queryKey: ['localAllExpenseCategories'] });
    },
  });

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    if (!allCategories) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= allCategories.length) return;

    const copy = [...allCategories];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    reorderCategoriesMutation.mutate(copy.map((c: any) => c.id));
  };

  const exportMutation = useMutation({
    mutationFn: () => exportDatabaseToJson(),
    onSuccess: (data) => {
      const jsonStr = JSON.stringify(data, null, 2);
      setExportedJsonText(jsonStr);
      setExportModalVisible(true);
      showSuccess('Export Ready', 'Full SQLite backup JSON generated.');
    },
    onError: (err: any) => showError('Export Error', err.message),
  });

  const importMutation = useMutation({
    mutationFn: (backup: any) => importDatabaseFromJson(backup),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setImportModalVisible(false);
      setImportJsonText('');
      showSuccess('Data Restored', 'Your database has been restored from backup successfully.');
    },
    onError: (err: any) => showError('Import Error', err.message || 'Invalid JSON format'),
  });

  const resetAllMutation = useMutation({
    mutationFn: () => userRepository.resetAllData(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      showSuccess('Data Reset', 'All database tables have been reset to seeded defaults.');
    },
    onError: (err: any) => showError('Reset Error', err.message),
  });

  // Cloud Backup Mutations
  const connectGoogleMutation = useMutation({
    mutationFn: async () => loginWithGoogle(),
    onSuccess: async (tokens) => {
      refetchCloudAuth();
      const hasPwd = !!(await getSecureItem(SECURE_KEYS.BACKUP_PASSWORD));
      if (!hasPwd) {
        setCloudPasswordInput('');
        setCloudPasswordConfirmInput('');
        setCloudPasswordModalVisible(true);
      } else {
        showSuccess(
          'Google Drive Connected',
          tokens.userEmail ? `Connected as ${tokens.userEmail}` : 'Google Drive linked successfully.'
        );
        executeBackupMutation.mutate();
      }
    },
    onError: (err: any) => {
      showError('Connection Failed', err.message || 'Could not authenticate with Google.');
    },
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      await clearAuthSession();
      await userRepository.setSetting('cloud_backup_status', 'not_connected');
    },
    onSuccess: () => {
      refetchCloudAuth();
      showSuccess('Disconnected', 'Google account and credentials cleared from device.');
    },
    onError: (err: any) => showError('Disconnect Error', err.message),
  });

  const savePasswordMutation = useMutation({
    mutationFn: async (pwd: string) => {
      if (!pwd || pwd.length < 4) {
        throw new Error('Password must be at least 4 characters long.');
      }
      await setSecureItem(SECURE_KEYS.BACKUP_PASSWORD, pwd);
      const res = await executeCloudBackup(pwd);
      if (!res.success) {
        throw new Error(res.error || 'Initial backup failed');
      }
      return res;
    },
    onSuccess: () => {
      setCloudPasswordModalVisible(false);
      refetchCloudAuth();
      showSuccess('Backup Password Saved', 'Vault encrypted with AES-256-GCM and backed up to Google Drive.');
    },
    onError: (err: any) => showError('Password Error', err.message),
  });

  const executeBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await executeCloudBackup();
      if (!res.success) {
        throw new Error(res.error || 'Backup failed');
      }
      return res;
    },
    onSuccess: () => {
      refetchCloudAuth();
      showSuccess('Cloud Backup Complete', 'Encrypted database snapshot saved to Google Drive appDataFolder.');
    },
    onError: (err: any) => showError('Backup Failed', err.message),
  });

  const restoreCloudMutation = useMutation({
    mutationFn: async (pwd: string) => {
      return await restoreFromCloud(pwd);
    },
    onSuccess: (res) => {
      setCloudRestoreModalVisible(false);
      setCloudRestorePasswordInput('');
      queryClient.invalidateQueries();
      refetchCloudAuth();
      showSuccess(
        'Database Restored',
        res.safetyBackupPath
          ? 'Data decrypted and restored successfully. Safety backup snapshot created.'
          : 'Data decrypted and restored successfully from Google Drive.'
      );
    },
    onError: (err: any) => showError('Restore Failed', err.message),
  });

  const handleDisconnectGoogle = () => {
    confirm({
      title: 'Disconnect Google Drive',
      message: 'Are you sure you want to disconnect Google Drive? Automatic cloud backup will pause until reconnected.',
      confirmText: 'Disconnect',
      isDestructive: true,
      onConfirm: () => disconnectGoogleMutation.mutate(),
    });
  };

  const handleConfirmCloudRestore = () => {
    if (!cloudRestorePasswordInput.trim()) {
      showError('Validation Error', 'Please enter your Backup Password.');
      return;
    }
    confirm({
      title: 'Restore Database from Cloud',
      message: 'This will replace current local records with the latest Google Drive backup. A local safety copy will be taken first. Continue?',
      confirmText: 'Yes, Restore',
      isDestructive: true,
      onConfirm: () => restoreCloudMutation.mutate(cloudRestorePasswordInput.trim()),
    });
  };

  const handleSaveCloudPassword = () => {
    if (!cloudPasswordInput || cloudPasswordInput.length < 4) {
      showError('Validation Error', 'Password must be at least 4 characters.');
      return;
    }
    if (cloudPasswordInput !== cloudPasswordConfirmInput) {
      showError('Validation Error', 'Passwords do not match.');
      return;
    }
    savePasswordMutation.mutate(cloudPasswordInput);
  };

  // Action Handlers
  const handleOpenProfileModal = () => {
    if (profile) {
      setEditName(profile.name || '');
      setEditEmail(profile.email || '');
      setEditCurrency(profile.currency || 'EUR');
      setEditTimezone(profile.timezone || 'Europe/Amsterdam');
      setEditInitialSavings(String(profile.initialSavings || '1500'));
    }
    setProfileModalVisible(true);
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      name: editName.trim(),
      email: editEmail.trim(),
      currency: editCurrency.trim(),
      timezone: editTimezone.trim(),
      initialSavings: parseFloat(editInitialSavings.replace(',', '.')) || 0,
    });
  };

  const handleOpenEmploymentModal = () => {
    if (employment) {
      setEditEmployer(employment.employerName || '');
      setEditAgency(employment.agencyName || '');
      setEditRole(employment.role || '');
      setEditLocation(employment.location || '');
    }
    setEmploymentModalVisible(true);
  };

  const handleSaveEmployment = () => {
    if (!employment) return;
    updateEmploymentMutation.mutate({
      id: employment.id,
      data: {
        employerName: editEmployer.trim(),
        agencyName: editAgency.trim(),
        role: editRole.trim(),
        location: editLocation.trim(),
      },
    });
  };

  const handleOpenPayrollModal = () => {
    if (activeConfig) {
      setEditBaseRate(String(activeConfig.baseHourlyRate || '14.99'));
      setEditAdvRate(String(activeConfig.advHourlyRate || '1.35'));
      setEditHolidayPct(String(activeConfig.holidayAllowancePercentage || '8.0'));
      setEditHealthWeekly(String(activeConfig.healthInsuranceWeekly || '35.40'));
      setEditAddInsurance(String(activeConfig.additionalInsuranceWeekly || '0.00'));
      setEditTaxRate(String(activeConfig.estimatedTaxRatePercentage || '17.5'));
    }
    setPayrollModalVisible(true);
  };

  const handleSavePayroll = () => {
    if (!activeConfig) return;
    updatePayrollMutation.mutate({
      id: activeConfig.id,
      data: {
        baseHourlyRate: parseFloat(editBaseRate.replace(',', '.')),
        advHourlyRate: parseFloat(editAdvRate.replace(',', '.')),
        holidayAllowancePercentage: parseFloat(editHolidayPct.replace(',', '.')),
        healthInsuranceWeekly: parseFloat(editHealthWeekly.replace(',', '.')),
        additionalInsuranceWeekly: parseFloat(editAddInsurance.replace(',', '.')),
        estimatedTaxRatePercentage: parseFloat(editTaxRate.replace(',', '.')),
      },
    });
  };

  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryNameInput('');
    setCategoryColorInput('#10B981');
    setCategoryIconInput('tag');
    setCategoryActiveInput(true);
    setCategoryModalVisible(true);
  };

  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCategoryNameInput(cat.name);
    setCategoryColorInput(cat.color || '#10B981');
    setCategoryIconInput(cat.icon || 'tag');
    setCategoryActiveInput(cat.isActive === 1);
    setCategoryModalVisible(true);
  };

  const handleSaveCategory = () => {
    if (!categoryNameInput.trim()) {
      showError('Validation Error', 'Category name is required');
      return;
    }

    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        data: {
          name: categoryNameInput.trim(),
          color: categoryColorInput,
          icon: categoryIconInput,
          isActive: categoryActiveInput,
        },
      });
    } else {
      createCategoryMutation.mutate({
        name: categoryNameInput.trim(),
        color: categoryColorInput,
        icon: categoryIconInput,
        isActive: categoryActiveInput,
      });
    }
  };

  const handleProtectedReset = () => {
    confirm({
      title: 'Reset All Data',
      message: 'Are you sure you want to completely erase all work history, shifts, expenses, and payslips? All local SQLite tables will be wiped and re-seeded.',
      confirmText: 'Yes, Erase Everything',
      isDestructive: true,
      onConfirm: () => resetAllMutation.mutate(),
    });
  };

  const handleConfirmImport = () => {
    if (!importJsonText.trim()) {
      showError('Validation Error', 'Please paste the backup JSON data');
      return;
    }
    try {
      const parsed = JSON.parse(importJsonText);
      confirm({
        title: 'Restore Database',
        message: 'This will replace current SQLite records with the backup data. Continue?',
        confirmText: 'Restore',
        isDestructive: true,
        onConfirm: () => importMutation.mutate(parsed),
      });
    } catch (err: any) {
      showError('Invalid JSON', err.message || 'The provided text is not valid JSON format.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Local-First Architecture</Text>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
        </View>

        {/* 1. Appearance & Theme */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <Sparkles size={16} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginLeft: 8 }]}>APPEARANCE & THEME</Text>
            </View>
          </View>

          <Text style={[styles.cardSublabel, { color: colors.textSecondary }]}>
            Select your preferred color theme. Persisted locally in SQLite.
          </Text>

          <View style={[styles.themeSelectorRow, { backgroundColor: colors.backgroundSecondary }]}>
            {(['dark', 'light', 'system'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setThemeMode(mode)}
                style={[
                  styles.themeOptionBtn,
                  themeMode === mode && [styles.themeOptionBtnActive, { backgroundColor: colors.card }],
                ]}
              >
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: themeMode === mode ? colors.primary : colors.textTertiary },
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 2. Worker Profile */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <User size={16} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginLeft: 8 }]}>WORKER PROFILE</Text>
            </View>
            <TouchableOpacity onPress={handleOpenProfileModal} style={styles.editIconButton}>
              <Edit3 size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{profile?.name || 'Worker'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{profile?.email || 'worker@paytrack.local'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Initial Balance</Text>
            <Text style={[styles.fieldValue, { color: colors.primary }]}>{formatEUR(profile?.initialSavings ?? 1500)}</Text>
          </View>
        </View>

        {/* 3. Employment & Workplace */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <Building2 size={16} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginLeft: 8 }]}>EMPLOYMENT & AGENCY</Text>
            </View>
            <TouchableOpacity onPress={handleOpenEmploymentModal} style={styles.editIconButton}>
              <Edit3 size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Agency</Text>
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{employment?.agencyName || 'Carrière Personeelsdiensten'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Employer</Text>
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{employment?.employerName || 'Albert Heijn B.V.'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Role</Text>
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{employment?.role || 'Order Picker'}</Text>
          </View>
        </View>

        {/* 4. CAO Payroll Parameters */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <Sliders size={16} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginLeft: 8 }]}>CAO PAYROLL ENGINE</Text>
            </View>
            <TouchableOpacity onPress={handleOpenPayrollModal} style={styles.editIconButton}>
              <Edit3 size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Base Hourly Rate</Text>
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{formatEUR(activeConfig?.baseHourlyRate ?? 14.99)}/h</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ADV Allowance</Text>
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>+{formatEUR(activeConfig?.advHourlyRate ?? 1.35)}/h</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Holiday Allowance</Text>
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{activeConfig?.holidayAllowancePercentage ?? 8.0}%</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Weekly Health Insurance</Text>
            <Text style={[styles.fieldValue, { color: colors.danger }]}>-{formatEUR(activeConfig?.healthInsuranceWeekly ?? 38.01)}</Text>
          </View>
        </View>

        {/* 5. Expense Categories Management */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <Tag size={16} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginLeft: 8 }]}>EXPENSE CATEGORIES</Text>
            </View>
            <TouchableOpacity
              onPress={() => setManageCategoriesModalVisible(true)}
              style={[styles.manageBtn, { backgroundColor: colors.primaryBg }]}
            >
              <Text style={[styles.manageBtnText, { color: colors.primary }]}>Manage</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBadgeScroll}>
            {categories?.map((cat: any) => (
              <View
                key={cat.id}
                style={[
                  styles.categoryBadge,
                  { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder },
                ]}
              >
                <View style={[styles.categoryBadgeDot, { backgroundColor: cat.color || colors.primary }]} />
                <Text style={[styles.categoryBadgeText, { color: colors.textPrimary }]}>{cat.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 6. Cloud Backup (Google Drive Zero-Knowledge Vault) */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <Cloud size={16} color={colors.blue} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginLeft: 8 }]}>
                GOOGLE DRIVE BACKUP & ENCRYPTION
              </Text>
            </View>
            <TouchableOpacity onPress={() => setCloudInfoModalVisible(true)}>
              <ExternalLink size={15} color={colors.blue} />
            </TouchableOpacity>
          </View>

          {/* Connected State Banner */}
          {cloudAuthData?.isConnected ? (
            <>
              <View style={[styles.cloudAccountRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cloudUserLabel, { color: colors.textTertiary }]}>LINKED ACCOUNT</Text>
                  <Text style={[styles.cloudUserEmail, { color: colors.textPrimary }]} numberOfLines={1}>
                    {cloudAuthData.userEmail}
                  </Text>
                </View>

                {/* Status Badge */}
                <View
                  style={[
                    styles.syncBadge,
                    cloudAuthData.syncStatus === 'synced' && { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: colors.primary },
                    cloudAuthData.syncStatus === 'syncing' && { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: colors.blue },
                    cloudAuthData.syncStatus === 'pending' && { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: colors.amber },
                    cloudAuthData.syncStatus === 'error' && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: colors.danger },
                  ]}
                >
                  {cloudAuthData.syncStatus === 'syncing' && (
                    <ActivityIndicator size="small" color={colors.blue} style={{ marginRight: 4 }} />
                  )}
                  {cloudAuthData.syncStatus === 'synced' && (
                    <CheckCircle2 size={12} color={colors.primary} style={{ marginRight: 4 }} />
                  )}
                  {cloudAuthData.syncStatus === 'pending' && (
                    <Clock size={12} color={colors.amber} style={{ marginRight: 4 }} />
                  )}
                  {cloudAuthData.syncStatus === 'error' && (
                    <AlertTriangle size={12} color={colors.danger} style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.syncBadgeText,
                      cloudAuthData.syncStatus === 'synced' && { color: colors.primary },
                      cloudAuthData.syncStatus === 'syncing' && { color: colors.blue },
                      cloudAuthData.syncStatus === 'pending' && { color: colors.amber },
                      cloudAuthData.syncStatus === 'error' && { color: colors.danger },
                    ]}
                  >
                    {cloudAuthData.syncStatus === 'synced' ? 'Synced' :
                     cloudAuthData.syncStatus === 'syncing' ? 'Syncing...' :
                     cloudAuthData.syncStatus === 'pending' ? 'Pending' :
                     cloudAuthData.syncStatus === 'error' ? 'Error' : 'Connected'}
                  </Text>
                </View>
              </View>

              {cloudAuthData.lastBackupAt ? (
                <Text style={[styles.lastBackupText, { color: colors.textTertiary }]}>
                  Last Cloud Snapshot: {new Date(cloudAuthData.lastBackupAt).toLocaleString()}
                </Text>
              ) : null}

              {cloudAuthData.lastError ? (
                <Text style={[styles.lastErrorText, { color: colors.danger }]}>
                  {cloudAuthData.lastError}
                </Text>
              ) : null}

              <View style={[styles.encryptionNote, { backgroundColor: 'rgba(56, 189, 248, 0.1)' }]}>
                <Lock size={14} color={colors.blue} />
                <Text style={[styles.encryptionNoteText, { color: colors.blue }]}>
                  Zero-Knowledge AES-256-GCM encryption is active. Only you can decrypt your backup.
                </Text>
              </View>

              <View style={styles.cloudActionRow}>
                <TouchableOpacity
                  onPress={() => executeBackupMutation.mutate()}
                  disabled={executeBackupMutation.isPending || cloudAuthData.syncStatus === 'syncing'}
                  style={[styles.cloudPrimaryBtn, { backgroundColor: colors.primary }]}
                >
                  {executeBackupMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <>
                      <UploadCloud size={15} color={colors.textInverse} />
                      <Text style={[styles.cloudPrimaryBtnText, { color: colors.textInverse }]}>Backup Now</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setCloudRestorePasswordInput('');
                    setCloudRestoreModalVisible(true);
                  }}
                  disabled={restoreCloudMutation.isPending}
                  style={[styles.cloudSecondaryBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}
                >
                  <DownloadCloud size={15} color={colors.textPrimary} />
                  <Text style={[styles.cloudSecondaryBtnText, { color: colors.textPrimary }]}>Restore</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cloudSubActionRow}>
                <TouchableOpacity
                  onPress={() => {
                    setCloudPasswordInput('');
                    setCloudPasswordConfirmInput('');
                    setCloudPasswordModalVisible(true);
                  }}
                  style={styles.cloudTextAction}
                >
                  <Key size={13} color={colors.textSecondary} />
                  <Text style={[styles.cloudTextActionLabel, { color: colors.textSecondary }]}>Change Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDisconnectGoogle}
                  disabled={disconnectGoogleMutation.isPending}
                  style={styles.cloudTextAction}
                >
                  <LogOut size={13} color={colors.danger} />
                  <Text style={[styles.cloudTextActionLabel, { color: colors.danger }]}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.cardSublabel, { color: colors.textSecondary, marginBottom: 16 }]}>
                Connect your Google account to automatically back up your SQLite database to Google Drive appDataFolder with client-side Zero-Knowledge AES-256-GCM encryption.
              </Text>

              <TouchableOpacity
                onPress={() => connectGoogleMutation.mutate()}
                disabled={connectGoogleMutation.isPending}
                style={[styles.connectGoogleBtn, { backgroundColor: colors.primary }]}
              >
                {connectGoogleMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <>
                    <Cloud size={16} color={colors.textInverse} />
                    <Text style={[styles.connectGoogleBtnText, { color: colors.textInverse }]}>
                      Connect Google Drive
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => setCloudInfoModalVisible(true)}
            style={[styles.cloudDetailsBtn, { borderColor: colors.cardBorder, marginTop: 12 }]}
          >
            <Text style={[styles.cloudDetailsBtnText, { color: colors.textPrimary }]}>View Cloud Architecture Blueprint</Text>
          </TouchableOpacity>
        </View>

        {/* 7. Local Database Backup & Restore */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <FileCode2 size={16} color={colors.blue} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginLeft: 8 }]}>LOCAL DATABASE JSON</Text>
            </View>
          </View>

          <Text style={[styles.backupHint, { color: colors.textSecondary }]}>
            Export your entire work history, shifts, expenses, and payslips to structured JSON, or restore from a previous backup file.
          </Text>

          <View style={styles.backupButtonsRow}>
            <TouchableOpacity
              onPress={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              activeOpacity={0.8}
              style={[styles.exportButton, { backgroundColor: colors.primary }]}
            >
              {exportMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <Download size={16} color={colors.textInverse} />
                  <Text style={[styles.exportButtonText, { color: colors.textInverse }]}>Export JSON</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setImportModalVisible(true)}
              activeOpacity={0.8}
              style={[styles.importButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}
            >
              <Upload size={16} color={colors.textPrimary} />
              <Text style={[styles.importButtonText, { color: colors.textPrimary }]}>Restore JSON</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 8. Danger Zone: Protected Reset */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.danger }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHeadingRow}>
              <AlertTriangle size={16} color={colors.danger} />
              <Text style={[styles.sectionLabel, { color: colors.danger, marginLeft: 8 }]}>DANGER ZONE</Text>
            </View>
          </View>

          <Text style={[styles.dangerHint, { color: colors.textSecondary }]}>
            Erase all SQLite tables and restore app state to initial seeded defaults.
          </Text>

          <TouchableOpacity
            onPress={handleProtectedReset}
            disabled={resetAllMutation.isPending}
            style={[styles.resetButton, { borderColor: colors.danger, backgroundColor: colors.dangerBg }]}
          >
            {resetAllMutation.isPending ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <>
                <RotateCcw size={15} color={colors.danger} />
                <Text style={[styles.resetButtonText, { color: colors.danger }]}>Reset All Local Data</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modals */}
      {/* 1. Profile Edit Modal */}
      <Modal visible={profileModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>FULL NAME</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EMAIL</Text>
            <TextInput
              value={editEmail}
              onChangeText={setEditEmail}
              keyboardType="email-address"
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>INITIAL SAVINGS BALANCE (€)</Text>
            <TextInput
              value={editInitialSavings}
              onChangeText={setEditInitialSavings}
              keyboardType="decimal-pad"
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <TouchableOpacity onPress={handleSaveProfile} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Save Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Employment Edit Modal */}
      <Modal visible={employmentModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Workplace</Text>
              <TouchableOpacity onPress={() => setEmploymentModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>AGENCY NAME</Text>
            <TextInput
              value={editAgency}
              onChangeText={setEditAgency}
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EMPLOYER</Text>
            <TextInput
              value={editEmployer}
              onChangeText={setEditEmployer}
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>JOB ROLE</Text>
            <TextInput
              value={editRole}
              onChangeText={setEditRole}
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <TouchableOpacity onPress={handleSaveEmployment} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Save Workplace</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. Payroll Edit Modal */}
      <Modal visible={payrollModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Payroll Parameters</Text>
              <TouchableOpacity onPress={() => setPayrollModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>BASE HOURLY RATE (€)</Text>
            <TextInput
              value={editBaseRate}
              onChangeText={setEditBaseRate}
              keyboardType="decimal-pad"
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ADV HOURLY RATE (€)</Text>
            <TextInput
              value={editAdvRate}
              onChangeText={setEditAdvRate}
              keyboardType="decimal-pad"
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>WEEKLY HEALTH INSURANCE (€)</Text>
            <TextInput
              value={editHealthWeekly}
              onChangeText={setEditHealthWeekly}
              keyboardType="decimal-pad"
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <TouchableOpacity onPress={handleSavePayroll} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Save Parameters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. Category Management Modal (Section 3) */}
      <Modal visible={manageCategoriesModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder, maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Expense Categories</Text>
              <TouchableOpacity onPress={() => setManageCategoriesModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleOpenAddCategory}
              style={[styles.addCatBtn, { backgroundColor: colors.primary }]}
            >
              <Plus size={16} color={colors.textInverse} />
              <Text style={[styles.addCatBtnText, { color: colors.textInverse }]}>Add New Category</Text>
            </TouchableOpacity>

            <ScrollView style={{ marginTop: 12 }}>
              {allCategories?.map((cat: any, idx: number) => (
                <View
                  key={cat.id}
                  style={[
                    styles.catManageRow,
                    { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder },
                  ]}
                >
                  <View style={[styles.catColorCircle, { backgroundColor: cat.color || colors.primary }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.catRowName, { color: colors.textPrimary }]}>{cat.name}</Text>
                    <Text style={[styles.catRowStatus, { color: cat.isActive === 1 ? colors.primary : colors.textTertiary }]}>
                      {cat.isActive === 1 ? 'Active' : 'Inactive'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => handleMoveCategory(idx, 'up')}
                      disabled={idx === 0}
                      style={[styles.reorderBtn, idx === 0 && { opacity: 0.3 }]}
                    >
                      <ArrowUp size={14} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleMoveCategory(idx, 'down')}
                      disabled={idx === (allCategories.length - 1)}
                      style={[styles.reorderBtn, idx === (allCategories.length - 1) && { opacity: 0.3 }]}
                    >
                      <ArrowDown size={14} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleOpenEditCategory(cat)} style={{ padding: 4 }}>
                      <Edit3 size={15} color={colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        confirm({
                          title: 'Delete Category',
                          message: `Remove "${cat.name}"? If historical expenses use this category, it will be safely deactivated without breaking past records.`,
                          confirmText: 'Delete',
                          isDestructive: true,
                          onConfirm: () => deleteCategoryMutation.mutate(cat.id),
                        });
                      }}
                      style={{ padding: 4 }}
                    >
                      <Trash2 size={15} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add / Edit Category Dialog */}
      <Modal visible={categoryModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingCategory ? 'Edit Category' : 'New Category'}
              </Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>NAME</Text>
            <TextInput
              value={categoryNameInput}
              onChangeText={setCategoryNameInput}
              placeholder="Groceries, Fuel, Subscriptions..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>COLOR (HEX)</Text>
            <TextInput
              value={categoryColorInput}
              onChangeText={setCategoryColorInput}
              placeholder="#10B981"
              placeholderTextColor={colors.textTertiary}
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 }}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary, marginBottom: 0 }]}>ACTIVE</Text>
              <Switch value={categoryActiveInput} onValueChange={setCategoryActiveInput} />
            </View>

            <TouchableOpacity onPress={handleSaveCategory} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Save Category</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cloud Architecture Info Modal (Section 7) */}
      <Modal visible={cloudInfoModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cloud Backup Architecture</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Zero-Knowledge Client-Side Encryption Blueprint</Text>
              </View>
              <TouchableOpacity onPress={() => setCloudInfoModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 8 }}>
              <View style={[styles.cloudInfoBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}>
                <Text style={[styles.cloudInfoHeading, { color: colors.primary }]}>1. Security Protocol</Text>
                <Text style={[styles.cloudInfoBody, { color: colors.textSecondary }]}>
                  Before database files leave this device, they are serialized to SQLite JSON and encrypted via AES-256-GCM using a user-derived passphrase with PBKDF2 (100,000 iterations). Google Drive receives only encrypted ciphertext (Zero-Knowledge).
                </Text>

                <Text style={[styles.cloudInfoHeading, { color: colors.primary, marginTop: 14 }]}>2. Storage Location</Text>
                <Text style={[styles.cloudInfoBody, { color: colors.textSecondary }]}>
                  • Google Drive AppData Folder: Uses the user's personal Google account with zero server storage costs, OAuth2 sandboxing, and no access to your personal Drive files.
                </Text>

                <Text style={[styles.cloudInfoHeading, { color: colors.primary, marginTop: 14 }]}>3. Integration Status</Text>
                <Text style={[styles.cloudInfoBody, { color: colors.textSecondary }]}>
                  Google Drive OAuth PKCE and automatic debounced sync are fully active and operational.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setCloudInfoModalVisible(false)}
                style={[styles.saveButton, { backgroundColor: colors.primary, marginTop: 14 }]}
              >
                <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cloud Backup Password Modal */}
      <Modal visible={cloudPasswordModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Set Backup Password</Text>
              <TouchableOpacity onPress={() => setCloudPasswordModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.encryptionNote, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: colors.amber, borderWidth: 1, marginBottom: 16 }]}>
              <AlertTriangle size={14} color={colors.amber} />
              <Text style={[styles.encryptionNoteText, { color: colors.amber, flex: 1, marginLeft: 6 }]}>
                Save this password securely! If you lose your phone or switch to a new device, you will need this password to decrypt your cloud backup. It cannot be recovered if lost.
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>BACKUP PASSWORD</Text>
            <TextInput
              value={cloudPasswordInput}
              onChangeText={setCloudPasswordInput}
              secureTextEntry
              placeholder="Enter at least 4 characters"
              placeholderTextColor={colors.textTertiary}
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CONFIRM PASSWORD</Text>
            <TextInput
              value={cloudPasswordConfirmInput}
              onChangeText={setCloudPasswordConfirmInput}
              secureTextEntry
              placeholder="Re-enter password"
              placeholderTextColor={colors.textTertiary}
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <TouchableOpacity
              onPress={handleSaveCloudPassword}
              disabled={savePasswordMutation.isPending}
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
            >
              {savePasswordMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Encrypt & Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cloud Restore Modal */}
      <Modal visible={cloudRestoreModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Restore from Google Drive</Text>
              <TouchableOpacity onPress={() => setCloudRestoreModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.cardSublabel, { color: colors.textSecondary, marginBottom: 16 }]}>
              Enter the Backup Password used to encrypt your vault. A safety snapshot of your current local database will be automatically created before restoring.
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>BACKUP PASSWORD</Text>
            <TextInput
              value={cloudRestorePasswordInput}
              onChangeText={setCloudRestorePasswordInput}
              secureTextEntry
              placeholder="Enter your backup password"
              placeholderTextColor={colors.textTertiary}
              style={[styles.textInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <TouchableOpacity
              onPress={handleConfirmCloudRestore}
              disabled={restoreCloudMutation.isPending}
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
            >
              {restoreCloudMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Verify & Restore</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal visible={exportModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Database Backup Ready</Text>
              <TouchableOpacity onPress={() => setExportModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary, marginBottom: 10 }]}>
              Copy or share this JSON payload to backup your complete PayTrack SQLite database.
            </Text>

            <ScrollView style={[styles.jsonBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}>
              <Text style={[styles.jsonText, { color: colors.textPrimary }]}>{exportedJsonText}</Text>
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                Share.share({ message: exportedJsonText, title: 'PayTrack Database Backup' });
              }}
              style={[styles.saveButton, { backgroundColor: colors.primary, marginTop: 12 }]}
            >
              <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Share / Save JSON</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Import Modal */}
      <Modal visible={importModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Restore from JSON</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.cardElevated }]}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary, marginBottom: 10 }]}>
              Paste the backup JSON text below to restore all tables atomically.
            </Text>

            <TextInput
              value={importJsonText}
              onChangeText={setImportJsonText}
              multiline
              placeholder="Paste JSON here..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.jsonInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <TouchableOpacity
              onPress={handleConfirmImport}
              disabled={importMutation.isPending}
              style={[styles.saveButton, { backgroundColor: colors.primary, marginTop: 12 }]}
            >
              {importMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Restore Database</Text>
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
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardSublabel: {
    fontSize: 12,
    marginBottom: 12,
  },
  editIconButton: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeSelectorRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  themeOptionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  themeOptionBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  manageBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  manageBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryBadgeScroll: {
    marginTop: 4,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  categoryBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cloudStatusBanner: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  cloudStatusItem: {
    flex: 1,
  },
  cloudStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  cloudStatusVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  encryptionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 10,
  },
  encryptionNoteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  cloudDetailsBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
  },
  cloudDetailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  backupHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  backupButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  importButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  importButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dangerHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    padding: 22,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  saveButton: {
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  addCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 10,
    gap: 6,
    marginBottom: 8,
  },
  addCatBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  catManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  catColorCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  catRowName: {
    fontSize: 14,
    fontWeight: '700',
  },
  catRowStatus: {
    fontSize: 11,
    marginTop: 1,
  },
  reorderBtn: {
    padding: 6,
    borderRadius: 6,
  },
  cloudInfoBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  cloudInfoHeading: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  cloudInfoBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  jsonBox: {
    maxHeight: 240,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  jsonText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
  },
  jsonInput: {
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    textAlignVertical: 'top',
  },
  cloudAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  cloudUserLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cloudUserEmail: {
    fontSize: 14,
    fontWeight: '600',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lastBackupText: {
    fontSize: 11,
    marginBottom: 8,
  },
  lastErrorText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  cloudActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  cloudPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
  },
  cloudPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cloudSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  cloudSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cloudSubActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cloudTextAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cloudTextActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  connectGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    minHeight: 48,
    marginBottom: 12,
  },
  connectGoogleBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
