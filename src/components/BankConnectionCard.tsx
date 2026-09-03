import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  RefreshCw,
  PowerOff,
  Building2,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag,
  Home,
} from 'lucide-react-native';
import { bankService, BankSyncResult } from '../services/bank/bankService';
import { useDatabaseRefresh } from '../hooks/useDatabaseRefresh';
import { useTheme } from '../theme/ThemeContext';
import { ColorPalette } from '../theme/colors';
import { useNotification } from './NotificationContext';
import { formatEUR, formatDateShort } from '../lib/formatters';

function maskIban(iban: string): string {
  if (!iban) return '•••• ••••';
  const clean = iban.replace(/\s+/g, '');
  if (clean.length < 8) return clean;
  const country = clean.substring(0, 2);
  const last4 = clean.substring(clean.length - 4);
  return `${country}•• •••• •••• ${last4}`;
}

export function BankConnectionCard() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { showSuccess, showError, confirm } = useNotification();
  const queryClient = useQueryClient();

  const [expanded, setExpanded] = useState(false);
  const [bankPickerVisible, setBankPickerVisible] = useState(false);

  // Queries
  const {
    data: bankOverview,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['localBankOverview'],
    queryFn: () => bankService.getActiveBankOverview(),
  });

  const { data: institutions = [] } = useQuery({
    queryKey: ['localBankInstitutions'],
    queryFn: () => bankService.getInstitutions('NL'),
    enabled: bankPickerVisible,
  });

  // DB Reactivity
  useDatabaseRefresh(['finance_changed'], () => {
    refetch();
  });

  // Mutations
  const connectMutation = useMutation({
    mutationFn: ({ id, name }: { id?: string; name?: string }) =>
      bankService.connectBank(id || 'ING_INGBNL2A', name || 'ING Netherlands'),
    onSuccess: (res) => {
      setBankPickerVisible(false);
      queryClient.invalidateQueries({ queryKey: ['localBankOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      showSuccess(
        'Bank Connected',
        `Successfully linked ${res.connection.institutionName}. Initial transactions imported.`
      );
    },
    onError: (err: any) => {
      showError('Connection Failed', err.message || 'Unable to connect to ING. Please try again.');
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => bankService.syncTransactions(),
    onSuccess: (res: BankSyncResult) => {
      queryClient.invalidateQueries({ queryKey: ['localBankOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      showSuccess(
        'Sync Completed',
        `Imported ${res.transactionsInserted} new transaction(s). ${res.transactionsSkipped} duplicate(s) prevented.`
      );
    },
    onError: (err: any) => {
      showError('Sync Error', err.message || 'Unable to sync bank transactions right now.');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => bankService.disconnectBank(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['localBankOverview'] });
      queryClient.invalidateQueries({ queryKey: ['localFinanceOverview'] });
      showSuccess('Bank Disconnected', res.message);
    },
    onError: (err: any) => {
      showError('Disconnect Error', err.message || 'Could not disconnect bank connection.');
    },
  });

  const handleDisconnect = () => {
    confirm({
      title: 'Disconnect Bank Account?',
      message:
        'Your bank connection session will be revoked. Your past imported transactions and financial history will remain safely stored in your local database.',
      confirmText: 'Disconnect',
      isDestructive: true,
      onConfirm: () => disconnectMutation.mutate(),
    });
  };

  const connection = bankOverview?.connection;
  const accounts = bankOverview?.accounts || [];
  const primaryAccount = accounts[0];
  const recentTransactions = bankOverview?.recentTransactions || [];
  const isConnected = connection && connection.status === 'CONNECTED';

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primaryLight} />
      </View>
    );
  }

  // --- CONNECTED STATE ---
  if (isConnected) {
    const formattedDate = connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt).toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Never';

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View style={styles.ingIconWell}>
              <Building2 size={18} color="#FF6200" />
            </View>
            <View>
              <Text style={styles.bankTitle}>{connection.institutionName}</Text>
              <Text style={styles.accountSubtitle}>
                {primaryAccount ? maskIban(primaryAccount.iban) : 'Checking Account'}
              </Text>
            </View>
          </View>

          <View style={styles.connectedBadge}>
            <CheckCircle2 size={12} color={colors.primaryLight} />
            <Text style={styles.connectedBadgeText}>Connected</Text>
          </View>
        </View>

        {/* Balance Display */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          <Text style={styles.balanceAmount}>
            {formatEUR(primaryAccount ? primaryAccount.balance : 0)}
          </Text>
          <Text style={styles.syncTimestamp}>Last synced: {formattedDate}</Text>
        </View>

        {/* Actions Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            style={[styles.syncButton, syncMutation.isPending && { opacity: 0.7 }]}
          >
            {syncMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <RefreshCw size={14} color={colors.textInverse} />
                <Text style={styles.syncButtonText}>Sync Transactions</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDisconnect}
            disabled={disconnectMutation.isPending}
            style={styles.disconnectButton}
          >
            <PowerOff size={14} color={colors.danger} />
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>

        {/* Transactions Expander Toggle */}
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          style={styles.expanderToggle}
        >
          <Text style={styles.expanderToggleText}>
            {expanded ? 'Hide Recent Bank Transactions' : `View Recent Transactions (${recentTransactions.length})`}
          </Text>
          {expanded ? (
            <ChevronUp size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {/* Expanded Recent Transactions List */}
        {expanded && (
          <View style={styles.txListContainer}>
            {recentTransactions.length === 0 ? (
              <Text style={styles.emptyTxText}>No bank transactions imported yet. Tap Sync to import.</Text>
            ) : (
              recentTransactions.slice(0, 8).map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <View key={tx.id} style={styles.txItem}>
                    <View style={styles.txLeft}>
                      <View style={styles.txDescRow}>
                        <Text style={styles.txCreditor} numberOfLines={1}>
                          {tx.creditorName || tx.debtorName || tx.remittanceInformation || 'Bank Transaction'}
                        </Text>
                        {tx.isRentMatch && (
                          <View style={styles.rentBadge}>
                            <Home size={10} color="#38BDF8" />
                            <Text style={styles.rentBadgeText}>Rent Match</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.txMetaRow}>
                        <Text style={styles.txDate}>{formatDateShort(tx.bookingDate)}</Text>
                        {tx.categoryName && (
                          <View style={styles.categoryPill}>
                            <Tag size={10} color={colors.textTertiary} />
                            <Text style={styles.categoryPillText}>{tx.categoryName}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        isPositive ? { color: colors.primaryLight } : { color: colors.textPrimary },
                      ]}
                    >
                      {isPositive ? `+${formatEUR(tx.amount)}` : formatEUR(tx.amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>
    );
  }

  // --- DISCONNECTED / CONNECT PROMPT STATE ---
  return (
    <View style={styles.card}>
      <View style={styles.promptHeader}>
        <View style={styles.ingIconWell}>
          <Building2 size={24} color="#FF6200" />
        </View>
        <View style={styles.promptTextWrap}>
          <Text style={styles.promptTitle}>Connect Bank Account</Text>
          <Text style={styles.promptSubtitle}>
            Connect your ING Netherlands account securely via Open Banking to import real-time balances and transactions.
          </Text>
        </View>
      </View>

      <View style={styles.privacyNote}>
        <ShieldCheck size={14} color={colors.primaryLight} />
        <Text style={styles.privacyNoteText}>
          Your bank credentials and PIN are never shared with PayTrack. Access is read-only and PSD2-compliant.
        </Text>
      </View>

      <View style={styles.promptActionRow}>
        <TouchableOpacity
          onPress={() => connectMutation.mutate({ id: 'ING_INGBNL2A', name: 'ING Netherlands' })}
          disabled={connectMutation.isPending}
          style={[styles.connectPrimaryButton, connectMutation.isPending && { opacity: 0.7 }]}
        >
          {connectMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <>
              <ExternalLink size={16} color={colors.textInverse} />
              <Text style={styles.connectPrimaryButtonText}>Connect ING Netherlands</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setBankPickerVisible(true)}
          style={styles.selectOtherButton}
        >
          <Text style={styles.selectOtherButtonText}>Select Other Bank</Text>
        </TouchableOpacity>
      </View>

      {/* Modal for Selecting Other Dutch Banks */}
      <Modal
        visible={bankPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBankPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Financial Institution</Text>
              <TouchableOpacity onPress={() => setBankPickerVisible(false)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {institutions.map((bank: any) => (
                <TouchableOpacity
                  key={bank.id}
                  style={styles.bankSelectItem}
                  onPress={() => {
                    connectMutation.mutate({ id: bank.id, name: bank.name });
                  }}
                >
                  <Building2 size={20} color={colors.primaryLight} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.bankSelectName}>{bank.name}</Text>
                    <Text style={styles.bankSelectCountry}>Netherlands (NL)</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    loadingContainer: {
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    ingIconWell: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: 'rgba(255, 98, 0, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    bankTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    accountSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    connectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryBg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    connectedBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primaryLight,
    },
    balanceContainer: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
    },
    balanceLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.textTertiary,
      marginBottom: 4,
    },
    balanceAmount: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    syncTimestamp: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 4,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    syncButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      gap: 6,
    },
    syncButtonText: {
      color: colors.textInverse,
      fontSize: 13,
      fontWeight: '700',
    },
    disconnectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      gap: 6,
    },
    disconnectButtonText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '600',
    },
    expanderToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    expanderToggleText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    txListContainer: {
      marginTop: 10,
    },
    emptyTxText: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
      paddingVertical: 12,
    },
    txItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.cardBorder,
    },
    txLeft: {
      flex: 1,
      marginRight: 10,
    },
    txDescRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    txCreditor: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    rentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
      gap: 3,
    },
    rentBadgeText: {
      fontSize: 10,
      color: '#38BDF8',
      fontWeight: '600',
    },
    txMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 3,
    },
    txDate: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    categoryPillText: {
      fontSize: 10,
      color: colors.textTertiary,
    },
    txAmount: {
      fontSize: 14,
      fontWeight: '700',
    },

    // Disconnected Prompt Styles
    promptHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    promptTextWrap: {
      flex: 1,
    },
    promptTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    promptSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    privacyNote: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      padding: 10,
      borderRadius: 8,
      marginBottom: 14,
      gap: 8,
    },
    privacyNoteText: {
      flex: 1,
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15,
    },
    promptActionRow: {
      flexDirection: 'column',
      gap: 8,
    },
    connectPrimaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 10,
      gap: 8,
    },
    connectPrimaryButtonText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '700',
    },
    selectOtherButton: {
      alignItems: 'center',
      paddingVertical: 6,
    },
    selectOtherButtonText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      borderTopWidth: 1,
      borderColor: colors.cardBorder,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalCloseText: {
      fontSize: 14,
      color: colors.primaryLight,
      fontWeight: '600',
    },
    bankSelectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.cardBorder,
    },
    bankSelectName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    bankSelectCountry: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
  });
}
