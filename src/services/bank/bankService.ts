import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { bankRepository, BankConnection, BankAccount, BankTransaction } from '../../database/repositories/bankRepository';
import { dbEvents } from '../../database/events';
import { categorizeTransaction } from './categorizer';

// Ensure any redirect in auth session is handled
WebBrowser.maybeCompleteAuthSession();

const DEFAULT_API_BASE_URL = 'https://paytrack-dun.vercel.app';

export function getApiBaseUrl(): string {
  let envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl && envUrl.length > 0) {
    let clean = envUrl.replace(/\/+$/, '');
    if (clean.endsWith('/api')) {
      clean = clean.slice(0, -4);
    }
    return clean;
  }
  return DEFAULT_API_BASE_URL;
}

function extractErrorMessage(errText: string, status: number, fallback: string): string {
  if (!errText || errText.trim().length === 0) {
    return `${fallback} (${status})`;
  }
  try {
    const parsed = JSON.parse(errText);
    if (parsed.details && parsed.error) {
      return `${parsed.error}: ${parsed.details}`;
    }
    if (parsed.error) {
      return typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
    }
    if (parsed.message) {
      return typeof parsed.message === 'string' ? parsed.message : JSON.stringify(parsed.message);
    }
    if (parsed.detail) {
      return typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
    }
    return JSON.stringify(parsed);
  } catch (_) {
    return errText.trim().slice(0, 250);
  }
}

export interface BankSyncResult {
  accountsCount: number;
  transactionsInserted: number;
  transactionsUpdated?: number;
  transactionsSkipped: number;
  totalTransactions: number;
  syncedAt: string;
}

export const bankService = {
  async getInstitutions(country = 'NL') {
    const baseUrl = getApiBaseUrl();
    if (__DEV__) {
      console.log(`[BankService] Fetching institutions from: ${baseUrl}/api/bank/institutions`);
    }
    const res = await fetch(`${baseUrl}/api/bank/institutions?country=${encodeURIComponent(country)}`);
    if (!res.ok) {
      throw new Error(`Failed to load banks (${res.status})`);
    }
    const data = await res.json();
    return data.institutions || [];
  },

  async connectBank(institutionId = 'ING', institutionName = 'ING Netherlands'): Promise<{
    connection: BankConnection;
    accounts: BankAccount[];
  }> {
    const baseUrl = getApiBaseUrl();
    const redirectUrl = `${baseUrl}/api/bank/callback`;

    // Generate dynamic Expo Linking redirect URL (supports both Expo Go and standalone apps)
    const appRedirectUrl = Linking.createURL('bank-callback');

    console.log(`[BankService] Initiating bank connection: POST ${baseUrl}/api/bank/connect (institution: ${institutionId}, appRedirect: ${appRedirectUrl})`);

    // 1. Initiate Requisition / Session on Backend
    const connectRes = await fetch(`${baseUrl}/api/bank/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        institutionId,
        aspspName: institutionId,
        redirectUrl,
        appRedirectUrl,
      }),
    });

    if (!connectRes.ok) {
      const errText = await connectRes.text();
      const msg = extractErrorMessage(errText, connectRes.status, 'Unable to connect to bank');
      throw new Error(`[${connectRes.status} from ${baseUrl}/api/bank/connect] ${msg}`);
    }

    const connectData = await connectRes.json();
    const link = connectData.link;
    const authState = connectData.state;

    if (!link) {
      throw new Error('Bank authorization link was not returned by server.');
    }

    // Safe diagnostic log of URL structure (no tokens or session keys)
    try {
      const parsedUrl = new URL(link);
      const queryParamNames = Array.from(parsedUrl.searchParams.keys()).join(', ');
      console.log(`[BankService] Opening Auth Session: domain=${parsedUrl.origin}, path=${parsedUrl.pathname}, params=[${queryParamNames}]`);
    } catch (_) {
      console.log('[BankService] Opening Auth Session');
    }

    // 2. Open In-App Browser for User Consent
    let callbackSessionId: string | undefined;
    let authCode: string | undefined;
    let returnState: string | undefined;

    try {
      // Use appRedirectUrl so Custom Tabs automatically returns to PayTrack upon callback
      const result = await WebBrowser.openAuthSessionAsync(link, appRedirectUrl);
      console.log(`[BankService] WebBrowser session finished: type=${result.type}`);
      if (result.type === 'success' && result.url) {
        try {
          const parsedReturn = new URL(result.url);
          callbackSessionId =
            parsedReturn.searchParams.get('session_id') ||
            parsedReturn.searchParams.get('ref') ||
            undefined;
          authCode = parsedReturn.searchParams.get('code') || undefined;
          returnState = parsedReturn.searchParams.get('state') || undefined;
        } catch (_) {}
      }
    } catch (browserErr: any) {
      console.warn('[BankService] WebBrowser notice:', browserErr?.message);
    }

    // 3. Fetch Accounts from Backend for this Session
    const queryParams = new URLSearchParams();
    if (callbackSessionId) {
      queryParams.set('sessionId', callbackSessionId);
      // NOTE: Do NOT pass code when sessionId is already available, preventing duplicate code exchange
    } else if (authCode) {
      queryParams.set('code', authCode);
    }
    const stateToPass = returnState || authState;
    if (stateToPass) {
      queryParams.set('state', stateToPass);
    }

    const accountsUrl = `${baseUrl}/api/bank/accounts?${queryParams.toString()}`;
    console.log(`[BankService] Fetching accounts: ${accountsUrl}`);

    const accountsRes = await fetch(accountsUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!accountsRes.ok) {
      const errText = await accountsRes.text();

      // Handle ALREADY_AUTHORIZED: recover existing active connection if present
      if (accountsRes.status === 422 && errText.includes('BANK_AUTH_SESSION_ALREADY_AUTHORIZED')) {
        const existingConn = await bankRepository.getActiveConnection();
        if (existingConn) {
          const existingAccounts = await bankRepository.listAccounts(existingConn.id);
          if (existingAccounts.length > 0) {
            console.log('[BankService] Reusing existing connection for already-authorized session');
            try {
              await this.syncTransactions(existingConn.id);
            } catch (_) {}
            dbEvents.emit('finance_changed');
            return { connection: existingConn, accounts: existingAccounts };
          }
        }
      }

      const msg = extractErrorMessage(errText, accountsRes.status, 'Unable to retrieve authorized bank accounts');
      throw new Error(`[${accountsRes.status} from ${baseUrl}/api/bank/accounts] ${msg}`);
    }

    const accountsData = await accountsRes.json();
    const rawAccounts = accountsData.accounts || [];

    if (rawAccounts.length === 0) {
      throw new Error(
        'No bank accounts were authorized by ING Netherlands. Please ensure you completed the consent flow.'
      );
    }

    const authorizedSessionId = accountsData.sessionId || callbackSessionId;
    if (!authorizedSessionId) {
      throw new Error('Authorized bank session ID was not returned by server.');
    }

    // 4. Save Connection to Local SQLite
    const connection = await bankRepository.saveConnection({
      institutionId,
      institutionName,
      requisitionId: authorizedSessionId,
      status: 'CONNECTED',
    });

    // 5. Save Accounts to Local SQLite with identificationHash matching
    const accounts = await bankRepository.saveAccounts(
      connection.id,
      rawAccounts.map((a: any) => ({
        gocardlessAccountId: a.id,
        iban: a.iban,
        identificationHash: a.identificationHash,
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
    } catch (syncErr: any) {
      console.warn('[BankService] Initial sync notice:', syncErr?.message);
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
    if (__DEV__) {
      console.log(`[BankService] Syncing transactions from: ${baseUrl}/api/bank/sync`);
    }
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalTransactions = 0;

    for (const acc of accounts) {
      const syncRes = await fetch(`${baseUrl}/api/bank/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          accountId: acc.gocardlessAccountId,
          sessionId: conn.requisitionId,
        }),
      });

      if (!syncRes.ok) {
        const errText = await syncRes.text();
        // If session expired or account not found, mark connection as EXPIRED
        if (syncRes.status === 404 || errText.includes('BANK_REAUTH_REQUIRED')) {
          await bankRepository.updateConnectionStatus(conn.id, 'EXPIRED');
          throw new Error('Your bank connection has expired. Please reconnect your bank.');
        }
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

      // Categorize and map transactions with refined rent matching
      const mappedTxList = rawTxList.map((tx: any) => {
        const cat = categorizeTransaction({
          amount: tx.amount,
          bookingDate: tx.bookingDate,
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
          status: tx.status,
          isRentMatch: cat.isRentMatch,
        };
      });

      const { inserted, updated, skipped } = await bankRepository.saveTransactions(acc.id, mappedTxList);
      totalInserted += inserted;
      totalUpdated += updated || 0;
      totalSkipped += skipped;
    }

    const now = new Date().toISOString();
    await bankRepository.updateLastSynced(conn.id, now);
    dbEvents.emit('finance_changed');

    return {
      accountsCount: accounts.length,
      transactionsInserted: totalInserted,
      transactionsUpdated: totalUpdated,
      transactionsSkipped: totalSkipped,
      totalTransactions,
      syncedAt: now,
    };
  },

  async disconnectBank(connectionId?: string): Promise<{ success: boolean; message: string }> {
    const conn = connectionId
      ? (await bankRepository.getConnectionById(connectionId))
      : await bankRepository.getActiveConnection();

    if (!conn) {
      return { success: true, message: 'No active bank connection.' };
    }

    const baseUrl = getApiBaseUrl();
    if (__DEV__) {
      console.log(`[BankService] Disconnecting session at: ${baseUrl}/api/bank/disconnect`);
    }
    try {
      await fetch(`${baseUrl}/api/bank/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: conn.requisitionId,
          requisitionId: conn.requisitionId,
        }),
      });
    } catch (err: any) {
      console.warn('[BankService] Disconnect API notice:', err?.message);
    }

    // Clean delete from database: removes connection and account mapping, retains historical transactions
    await bankRepository.deleteConnection(conn.id, false);
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
