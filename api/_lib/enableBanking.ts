import crypto from 'crypto';
import {
  BankInstitution,
  BankSessionDetails,
  BankAccountDetails,
  BankAccountBalances,
  BankTransactionItem,
} from './types';

const ENABLE_BANKING_API_BASE = 'https://api.enablebanking.com';

export function getEnableBankingCredentials(): {
  appId: string;
  privateKey: string;
  redirectUri: string;
} {
  const appId = process.env.ENABLE_BANKING_APP_ID || '';
  const privateKey = process.env.ENABLE_BANKING_PRIVATE_KEY || '';
  const redirectUri = process.env.ENABLE_BANKING_REDIRECT_URI || '';
  return { appId, privateKey, redirectUri };
}

function formatPrivateKey(rawKey: string): string {
  let key = rawKey.trim();
  if (!key.includes('\n') && key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  return key;
}

export function isMockMode(): boolean {
  const mode = (process.env.BANK_PROVIDER_MODE || 'auto').toLowerCase();
  if (mode === 'mock') return true;
  if (process.env.NODE_ENV === 'production') return false;
  const { appId, privateKey } = getEnableBankingCredentials();
  return mode === 'auto' && (!appId || !privateKey);
}

/**
 * Generates an RS256 signed JWT for Enable Banking API authentication.
 * Uses native Node.js crypto module with zero external dependencies.
 */
export function createEnableBankingJwt(): string {
  const { appId, privateKey } = getEnableBankingCredentials();
  if (!appId || !privateKey) {
    throw new Error(
      'Enable Banking server credentials (ENABLE_BANKING_APP_ID or ENABLE_BANKING_PRIVATE_KEY) are missing in environment.'
    );
  }

  const formattedKey = formatPrivateKey(privateKey);
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: appId,
  };

  const payload = {
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + 3600, // 1 hour validity
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(formattedKey, 'base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Executes an authenticated HTTPS request against the Enable Banking REST API.
 */
async function enableBankingRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const jwt = createEnableBankingJwt();
  const url = `${ENABLE_BANKING_API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const errBody = await res.text();
    // Sanitize error message to ensure no tokens or keys are leaked
    let cleanMsg = `Enable Banking API error [${res.status}]`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.message) cleanMsg += `: ${parsed.message}`;
      else if (parsed.error) cleanMsg += `: ${parsed.error}`;
    } catch {
      cleanMsg += `: Request failed`;
    }
    throw new Error(cleanMsg);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

/**
 * Retrieves institutions (ASPSPs) for a given country from Enable Banking.
 */
export async function getInstitutions(country = 'NL'): Promise<BankInstitution[]> {
  try {
    const data = await enableBankingRequest<any>(`/aspsps?country=${encodeURIComponent(country)}`);
    const list: any[] = data.aspsps || data || [];

    const formatted: BankInstitution[] = list.map((item: any) => ({
      id: item.name || item.id,
      name: item.title || item.name,
      bic: item.bic,
      countries: [country],
      logo: item.logo || undefined,
    }));

    // Prioritize ING Netherlands
    return formatted.sort((a, b) => {
      const aIsIng = a.name.toLowerCase().includes('ing');
      const bIsIng = b.name.toLowerCase().includes('ing');
      if (aIsIng && !bIsIng) return -1;
      if (!aIsIng && bIsIng) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err: any) {
    // Return standard fallback for Dutch banks if ASPSP endpoint is unavailable
    return [
      { id: 'ING', name: 'ING Netherlands', countries: ['NL'] },
      { id: 'ABN AMRO', name: 'ABN AMRO', countries: ['NL'] },
      { id: 'Rabobank', name: 'Rabobank', countries: ['NL'] },
      { id: 'SNS', name: 'SNS Bank', countries: ['NL'] },
    ];
  }
}

/**
 * Initiates an authorization session with Enable Banking.
 * Returns the bank authorization redirect URL.
 */
export async function startAuthorization(
  aspspName: string = 'ING',
  redirectUrl: string,
  state: string
): Promise<{ url: string; sessionId?: string }> {
  // Request 90 days validity period
  const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const body = {
    access: {
      valid_until: validUntil,
      balances: true,
      transactions: true,
    },
    aspsp: {
      name: aspspName,
      country: 'NL',
    },
    state,
    redirect_url: redirectUrl,
    psu_type: 'personal',
  };

  const res = await enableBankingRequest<any>('/auth', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    url: res.url,
    sessionId: res.session_id,
  };
}

/**
 * Exchanges the authorization code received in the callback for an active session.
 */
export async function exchangeCodeForSession(code: string): Promise<BankSessionDetails> {
  const data = await enableBankingRequest<any>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  const accountIds: string[] = (data.accounts || []).map((acc: any) => {
    if (typeof acc === 'string') return acc;
    return acc.account_id?.iban || acc.uid || acc.id || JSON.stringify(acc);
  });

  return {
    id: data.session_id,
    status: 'AUTHORIZED',
    accounts: accountIds,
    institutionId: data.aspsp?.name || 'ING',
    institutionName: data.aspsp?.title || data.aspsp?.name || 'ING Netherlands',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Retrieves account details for an authorized account UID.
 */
export async function getAccountDetails(
  accountId: string,
  institutionName = 'ING Netherlands'
): Promise<BankAccountDetails> {
  try {
    const data = await enableBankingRequest<any>(`/accounts/${encodeURIComponent(accountId)}`);
    const iban = data.account_id?.iban || data.iban || accountId;

    return {
      id: accountId,
      iban: iban.startsWith('NL') ? iban : `NL${iban}`,
      currency: data.currency || 'EUR',
      ownerName: data.party_name || data.ownerName,
      accountName: data.details || data.name || `${institutionName} Betaalrekening`,
      status: 'READY',
      bankName: institutionName,
    };
  } catch {
    // If /accounts/{id} is not supported directly, extract from accountId
    return {
      id: accountId,
      iban: accountId.startsWith('NL') ? accountId : `NL${accountId}`,
      currency: 'EUR',
      accountName: `${institutionName} Checking Account`,
      status: 'READY',
      bankName: institutionName,
    };
  }
}

/**
 * Retrieves account balances for an authorized account UID.
 */
export async function getAccountBalances(accountId: string): Promise<BankAccountBalances> {
  const data = await enableBankingRequest<any>(`/accounts/${encodeURIComponent(accountId)}/balances`);
  const balances: any[] = data.balances || [];

  let chosen = balances.find((b) => b.balance_type === 'CLBD' || b.balance_type === 'closingBooked');
  if (!chosen) {
    chosen = balances.find((b) => b.balance_type === 'ITAV' || b.balance_type === 'interimAvailable') || balances[0];
  }

  const rawAmount = chosen?.balance_amount?.amount ?? chosen?.balanceAmount?.amount ?? '0';
  const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount || '0');
  const currency = chosen?.balance_amount?.currency ?? chosen?.balanceAmount?.currency ?? 'EUR';

  const avail = balances.find((b) => b.balance_type === 'ITAV' || b.balance_type === 'interimAvailable');
  const rawAvail = avail?.balance_amount?.amount ?? avail?.balanceAmount?.amount;
  const availAmount = rawAvail !== undefined ? (typeof rawAvail === 'number' ? rawAvail : parseFloat(rawAvail)) : null;

  return {
    balance: Number(amount.toFixed(2)),
    availableBalance: availAmount !== null && !isNaN(availAmount) ? Number(availAmount.toFixed(2)) : null,
    currency,
    referenceDate: chosen?.reference_date || chosen?.last_change_date_time,
  };
}

/**
 * Retrieves transactions for an authorized account UID.
 */
export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string
): Promise<BankTransactionItem[]> {
  let endpoint = `/accounts/${encodeURIComponent(accountId)}/transactions`;
  if (dateFrom) {
    endpoint += `?date_from=${encodeURIComponent(dateFrom)}`;
  }

  const data = await enableBankingRequest<any>(endpoint);
  const rawTransactions: any[] = data.transactions || [];

  return rawTransactions.map((tx: any) => {
    const rawAmount = tx.transaction_amount?.amount ?? tx.transactionAmount?.amount ?? 0;
    const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount || '0');
    const currency = tx.transaction_amount?.currency ?? tx.transactionAmount?.currency ?? 'EUR';

    let remittance: string | null = null;
    if (Array.isArray(tx.remittance_information)) {
      remittance = tx.remittance_information.join(' ');
    } else if (typeof tx.remittance_information === 'string') {
      remittance = tx.remittance_information;
    } else if (tx.remittance_information_unstructured) {
      remittance = tx.remittance_information_unstructured;
    }

    const txId =
      tx.entry_reference ||
      tx.transaction_id ||
      tx.id ||
      `${accountId}_${tx.booking_date || tx.transaction_date}_${amount}`;

    const isBooked = !tx.status || tx.status === 'BOOK' || tx.status === 'BOOKED';

    return {
      transactionId: txId,
      amount: Number(amount.toFixed(2)),
      currency,
      bookingDate: tx.booking_date || tx.transaction_date || tx.value_date || new Date().toISOString().substring(0, 10),
      valueDate: tx.value_date || null,
      remittanceInformation: remittance ? remittance.trim() : null,
      creditorName: tx.creditor?.name || tx.creditor_name || null,
      debtorName: tx.debtor?.name || tx.debtor_name || null,
      status: isBooked ? 'BOOKED' : 'PENDING',
    };
  });
}

/**
 * Revokes and deletes a bank session.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await enableBankingRequest<void>(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  } catch (err: any) {
    // Ignore 404 if session is already expired or deleted externally
    if (!err.message?.includes('404')) {
      throw err;
    }
  }
}
