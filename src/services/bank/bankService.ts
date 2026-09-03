import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { bankRepository, BankConnection, BankAccount, BankTransaction } from '../../database/repositories/bankRepository';
import { dbEvents } from '../../database/events';
import { categorizeTransaction } from './categorizer';

// Ensure any redirect in auth session is handled
WebBrowser.maybeCompleteAuthSession();

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  // If running in Android emulator, localhost is 10.0.2.2
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

export interface BankSyncResult {
  accountsCount: number;
  transactionsInserted: number;
  transactionsSkipped: number;
  totalTransactions: number;
  syncedAt: string;
}

export const bankService = {
  async getInstitutions(country = 'NL') {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/bank/institutions?country=${encodeURIComponent(country)}`);
    if (!res.ok) {
      throw new Error(`Failed to load banks (${res.status})`);
    }
    const data = await res.json();
    return data.institutions || [];
  },

  async connectBank(institutionId = 'ING_INGBNL2A', institutionName = 'ING Netherlands'): Promise<{
    connection: BankConnection;
    accounts: BankAccount[];
  }> {
    const baseUrl = getApiBaseUrl();
    const redirectUrl = `${baseUrl}/api/bank/callback`;

    // 1. Initiate Requisition on Backend
    const connectRes = await fetch(`${baseUrl}/api/bank/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        institutionId,
        redirectUrl,
        reference: `paytrack_${Date.now()}`,
      }),
    });

    if (!connectRes.ok) {
      const errText = await connectRes.text();
      let msg = 'Unable to connect to bank. Please check server configuration.';
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error) msg = errJson.error;
      } catch (_) {}
      throw new Error(msg);
    }

    const { requisitionId, link } = await connectRes.json();

    // 2. Open In-App Browser for User Consent
    if (link) {
      try {
        const result = await WebBrowser.openAuthSessionAsync(link, 'paytrack://');
        if (result.type === 'cancel' || result.type === 'dismiss') {
          // Check if requisition was completed anyway before throwing
        }
      } catch (browserErr) {
        console.warn('[BankService] WebBrowser notice:', browserErr);
      }
    }

    // 3. Fetch Accounts from Backend for this Requisition
    const accountsRes = await fetch(
      `${baseUrl}/api/bank/accounts?requisitionId=${encodeURIComponent(requisitionId)}`
    );

    if (!accountsRes.ok) {
      throw new Error('Unable to retrieve authorized bank accounts. Please try again.');
    }

    const accountsData = await accountsRes.json();
    const rawAccounts = accountsData.accounts || [];

    if (rawAccounts.length === 0) {
      throw new Error(
        'No bank accounts were authorized by ING Netherlands. Please ensure you completed the consent flow.'
      );
    }

    // 4. Save Connection to Local SQLite
    const connection = await bankRepository.saveConnection({
      institutionId,
      institutionName,
      requisitionId,
      status: 'CONNECTED',
    });

    // 5. Save Accounts to Local SQLite
    const accounts = await bankRepository.saveAccounts(
      connection.id,
      rawAccounts.map((a: any) => ({
        gocardlessAccountId: a.id,
        iban: a.iban,
        accountName: a.accountName || `${institutionName} Account`,
        currency: a.currency || 'EUR',
        balance: a.balance || 0.0,
        availableBalance: a.availableBalance,
        bankName: a.bankName || institutionName,
        status: a.status || 'READY',
      }))
    );

    // 6. Automatically perform initial transaction sync
    try {
      await this.syncTransactions(connection.id);
    } catch (syncErr) {
      console.warn('[BankService] Initial sync notice:', syncErr);
    }

    dbEvents.emit('finance_changed');
    return { connection, accounts };
  },

  async syncTransactions(connectionId?: string): Promise<BankSyncResult> {
    const conn = connectionId
      ? (await bankRepository.listAccounts(connectionId)).length > 0
        ? await bankRepository.getActiveConnection()
        : null
      : await bankRepository.getActiveConnection();

    if (!conn) {
      throw new Error('No active bank connection found. Please connect your bank first.');
    }

    const accounts = await bankRepository.listAccounts(conn.id);
    if (accounts.length === 0) {
      throw new Error('No accounts linked to active bank connection.');
    }

    const baseUrl = getApiBaseUrl();
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalTransactions = 0;

    for (const acc of accounts) {
      const syncRes = await fetch(`${baseUrl}/api/bank/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ accountId: acc.gocardlessAccountId }),
      });

      if (!syncRes.ok) {
        console.warn(`[BankService] Sync error for account ${acc.id} (${syncRes.status})`);
        continue;
      }

      const syncData = await syncRes.json();
      const rawTxList = syncData.transactions || [];
      totalTransactions += rawTxList.length;

      // Update account balance if returned
      if (syncData.balances?.balance !== undefined) {
        await bankRepository.saveAccounts(conn.id, [
          {
            gocardlessAccountId: acc.gocardlessAccountId,
            iban: acc.iban,
            accountName: acc.accountName,
            currency: acc.currency,
            balance: syncData.balances.balance,
            availableBalance: syncData.balances.availableBalance,
            bankName: acc.bankName,
            status: acc.status,
          },
        ]);
      }

      // Categorize and map transactions
      const mappedTxList = rawTxList.map((tx: any) => {
        const cat = categorizeTransaction({
          amount: tx.amount,
          creditorName: tx.creditorName,
          debtorName: tx.debtorName,
          remittanceInformation: tx.remittanceInformation,
        });

        return {
          gocardlessTransactionId: tx.transactionId,
          amount: tx.amount,
          currency: tx.currency || 'EUR',
          bookingDate: tx.bookingDate,
          valueDate: tx.valueDate,
          remittanceInformation: tx.remittanceInformation,
          creditorName: tx.creditorName,
          debtorName: tx.debtorName,
          categoryId: cat.categoryId,
          status: tx.status || 'BOOKED',
          isRentMatch: cat.isRentMatch,
        };
      });

      // Save to local SQLite with unique constraint deduplication
      const { inserted, skipped } = await bankRepository.saveTransactions(acc.id, mappedTxList);
      totalInserted += inserted;
      totalSkipped += skipped;
    }

    const now = new Date().toISOString();
    await bankRepository.updateConnectionStatus(conn.id, 'CONNECTED', now);
    dbEvents.emit('finance_changed');

    return {
      accountsCount: accounts.length,
      transactionsInserted: totalInserted,
      transactionsSkipped: totalSkipped,
      totalTransactions,
      syncedAt: now,
    };
  },

  async disconnectBank(connectionId?: string): Promise<{ success: boolean; message: string }> {
    const conn = connectionId
      ? (await bankRepository.getActiveConnection())
      : await bankRepository.getActiveConnection();

    if (!conn) {
      return { success: true, message: 'No active bank connection.' };
    }

    const baseUrl = getApiBaseUrl();
    try {
      await fetch(`${baseUrl}/api/bank/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requisitionId: conn.requisitionId }),
      });
    } catch (err) {
      console.warn('[BankService] Disconnect API notice:', err);
    }

    await bankRepository.disconnectConnection(conn.id);
    dbEvents.emit('finance_changed');

    return {
      success: true,
      message: 'Bank connection disconnected. Historical transactions have been safely retained.',
    };
  },

  async getActiveBankOverview(): Promise<{
    connection: BankConnection | null;
    accounts: BankAccount[];
    recentTransactions: BankTransaction[];
  }> {
    const connection = await bankRepository.getActiveConnection();
    if (!connection) {
      return { connection: null, accounts: [], recentTransactions: [] };
    }

    const accounts = await bankRepository.listAccounts(connection.id);
    const recentTransactions = await bankRepository.listTransactions({ limit: 15 });

    return {
      connection,
      accounts,
      recentTransactions,
    };
  },
};
