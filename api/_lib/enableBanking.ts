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
  if (!rawKey) return '';
  let key = rawKey.trim();

  // Strip wrapping double or single quotes if present (common when pasting into env editors)
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // Case 1: The entire PEM file was base64-encoded (e.g. starts with 'LS0t' which is '---' in base64)
  if (key.startsWith('LS0t') || (!key.includes('-----') && key.length > 500)) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) {
        key = decoded.trim();
      }
    } catch (_) {}
  }

  // Normalize escaped newlines (\r\n or \n) to real newlines
  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

  // Case 2: Standard PEM (or single-line PEM with spaces) containing -----BEGIN and -----END
  if (key.includes('-----BEGIN') && key.includes('-----END')) {
    const headerMatch = key.match(/(-----BEGIN[A-Z0-9\s_-]+-----)/i);
    const footerMatch = key.match(/(-----END[A-Z0-9\s_-]+-----)/i);
    if (headerMatch && footerMatch) {
      const header = headerMatch[1].trim();
      const footer = footerMatch[1].trim();
      const startIndex = key.indexOf(headerMatch[0]) + headerMatch[0].length;
      const endIndex = key.indexOf(footerMatch[0]);
      // Extract the raw base64 body, stripping all whitespace/newlines
      const rawBody = key.substring(startIndex, endIndex).replace(/\s+/g, '');
      // Standard PEM wraps base64 body at 64 characters per line
      const wrappedBody = rawBody.match(/.{1,64}/g)?.join('\n') || rawBody;
      return `${header}\n${wrappedBody}\n${footer}\n`;
    }
  }

  // Case 3: Raw base64 string provided WITHOUT headers
  const cleaned = key.replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length > 200) {
    const wrappedBody = cleaned.match(/.{1,64}/g)?.join('\n') || cleaned;
    // Try PKCS#8 first
    const candidate8 = `-----BEGIN PRIVATE KEY-----\n${wrappedBody}\n-----END PRIVATE KEY-----\n`;
    try {
      crypto.createPrivateKey({ key: candidate8, format: 'pem' });
      return candidate8;
    } catch (_) {}

    // Try PKCS#1
    const candidate1 = `-----BEGIN RSA PRIVATE KEY-----\n${wrappedBody}\n-----END RSA PRIVATE KEY-----\n`;
    try {
      crypto.createPrivateKey({ key: candidate1, format: 'pem' });
      return candidate1;
    } catch (_) {}
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

  let keyObj: crypto.KeyObject;
  try {
    keyObj = crypto.createPrivateKey({
      key: formattedKey,
      format: 'pem',
    });
  } catch (parseErr: any) {
    const hasBegin = formattedKey.includes('-----BEGIN');
    const hasEnd = formattedKey.includes('-----END');
    const pemType = formattedKey.includes('RSA PRIVATE KEY') ? 'PKCS#1' : (formattedKey.includes('PRIVATE KEY') ? 'PKCS#8' : 'UNKNOWN');
    console.error(`[EnableBanking PrivateKey Error] Failed to parse PEM key. hasBegin=${hasBegin}, hasEnd=${hasEnd}, pemType=${pemType}, length=${formattedKey.length}, error=${parseErr?.message}`);
    throw new Error(
      `Failed to parse Enable Banking RSA private key: ${parseErr?.message || 'Invalid PEM format'}. Please ensure the full PEM key (including -----BEGIN ... and -----END ...) is correctly set in Vercel environment variables.`
    );
  }

  console.log(`[EnableBanking JWT] Private key parsed successfully. type=${keyObj.asymmetricKeyType}, modulusLength=${keyObj.asymmetricKeyDetails?.modulusLength || 'unknown'}`);

  let signature: string;
  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    signature = signer.sign(keyObj, 'base64url');
  } catch (signErr: any) {
    console.error(`[EnableBanking JWT Sign Error] message=${signErr?.message}`);
    throw new Error(`Failed to sign JWT with Enable Banking private key: ${signErr?.message}`);
  }

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

  console.log(`[EnableBanking API Request] ${options.method || 'GET'} ${endpoint}`);
  const res = await fetch(url, { ...options, headers });
  console.log(`[EnableBanking API Response] ${options.method || 'GET'} ${endpoint} -> status=${res.status}`);

  if (!res.ok) {
    const errBody = await res.text();
    // Sanitize error message to ensure no tokens or keys are leaked
    let cleanMsg = `Enable Banking API error [${res.status}]`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.message) cleanMsg += `: ${parsed.message}`;
      else if (parsed.error) cleanMsg += `: ${parsed.error}`;
      else if (parsed.detail) cleanMsg += `: ${parsed.detail}`;
    } catch {
      cleanMsg += `: ${errBody.slice(0, 100)}`;
    }
    console.error(`[EnableBanking API Error] status=${res.status}, message=${cleanMsg}`);
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

// In-memory serverless session cache (survives warm container invocations, keyed by sessionId and state)
interface CachedSession {
  session: BankSessionDetails;
  cachedAt: number;
}
const sessionCache = new Map<string, CachedSession>();

export function setCachedSession(session: BankSessionDetails, state?: string): void {
  const now = Date.now();
  const entry: CachedSession = { session, cachedAt: now };
  if (session.id) {
    sessionCache.set(session.id, entry);
  }
  if (state) {
    sessionCache.set(state, entry);
  }
}

export function getCachedSession(key?: string | null): BankSessionDetails | null {
  if (!key) return null;
  const entry = sessionCache.get(key);
  if (!entry) return null;
  // TTL: 15 minutes
  if (Date.now() - entry.cachedAt > 15 * 60 * 1000) {
    sessionCache.delete(key);
    return null;
  }
  return entry.session;
}

export function deleteCachedSession(key?: string | null): void {
  if (!key) return;
  sessionCache.delete(key);
}

/**
 * Initiates an authorization flow with Enable Banking for an ASPSP.
 * Returns the authorization link for the user.
 */
export async function startAuthorization(
  aspspName: string = 'ING',
  redirectUrl: string,
  state: string
): Promise<{ url: string; authFlowId?: string; sessionId?: string }> {
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

  let authFlowId: string | undefined;
  if (res.url) {
    try {
      const parsed = new URL(res.url);
      authFlowId = parsed.searchParams.get('sessionid') || undefined;
    } catch (_) {}
  }

  // NOTE: authFlowId is the Tilisy auth start token, NOT an authorized PSD2 session ID.
  return {
    url: res.url,
    authFlowId,
    sessionId: undefined,
  };
}

/**
 * Exchanges the authorization code received in the callback for an active session.
 */
export async function exchangeCodeForSession(code: string, state?: string): Promise<BankSessionDetails> {
  const data = await enableBankingRequest<any>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  const rawAccounts: any[] = data.accounts || [];
  const accountIds: string[] = rawAccounts
    .map((acc: any) => {
      if (typeof acc === 'string') return acc;
      // CRITICAL: acc.uid is the session-scoped account identifier needed by /accounts/{uid}/...
      return acc.uid || acc.id || acc.account_id?.iban;
    })
    .filter(Boolean);

  console.log(`[EnableBanking Sessions] Exchanged code for session: accountsCount=${accountIds.length}`);

  const sessionDetails: BankSessionDetails = {
    id: data.session_id,
    status: data.status || 'AUTHORIZED',
    accounts: accountIds,
    rawAccounts,
    institutionId: data.aspsp?.name || 'ING',
    institutionName: data.aspsp?.title || data.aspsp?.name || 'ING Netherlands',
    createdAt: new Date().toISOString(),
  };

  // Cache session so subsequent accounts calls can find it even if called with state or sessionId
  setCachedSession(sessionDetails, state);

  return sessionDetails;
}

/**
 * Retrieves existing session details and account identifiers by session ID.
 */
export async function getSession(sessionId: string): Promise<BankSessionDetails> {
  // Check in-memory cache first
  const cached = getCachedSession(sessionId);
  if (cached) {
    console.log(`[EnableBanking Sessions] Found cached session: status=${cached.status}, accountsCount=${cached.accounts.length}`);
    return cached;
  }

  try {
    const data = await enableBankingRequest<any>(`/sessions/${encodeURIComponent(sessionId)}`);

    const rawAccounts: any[] = data.accounts || [];
    const accountIds: string[] = rawAccounts
      .map((acc: any) => {
        if (typeof acc === 'string') return acc;
        // CRITICAL: acc.uid is the session-scoped account identifier needed by /accounts/{uid}/...
        return acc.uid || acc.id || acc.account_id?.iban;
      })
      .filter(Boolean);

    console.log(`[EnableBanking Sessions] Retrieved session: status=${data.status || 'AUTHORIZED'}, accountsCount=${accountIds.length}`);

    const sessionDetails: BankSessionDetails = {
      id: data.session_id || sessionId,
      status: data.status || 'AUTHORIZED',
      accounts: accountIds,
      rawAccounts,
      institutionId: data.aspsp?.name || 'ING',
      institutionName: data.aspsp?.title || data.aspsp?.name || 'ING Netherlands',
      createdAt: new Date().toISOString(),
    };

    setCachedSession(sessionDetails);
    return sessionDetails;
  } catch (err: any) {
    if (err?.message?.includes('404') || err?.status === 404) {
      const notFoundErr = new Error('Bank session not found or expired on Enable Banking');
      (notFoundErr as any).code = 'BANK_SESSION_NOT_FOUND';
      (notFoundErr as any).statusCode = 404;
      throw notFoundErr;
    }
    throw err;
  }
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
    const iban = data.account_id?.iban || data.iban || '';

    return {
      id: accountId,
      iban: iban.startsWith('NL') ? iban : (iban ? `NL${iban}` : 'NL00INGB0000000000'),
      currency: data.currency || 'EUR',
      ownerName: data.party_name || data.ownerName,
      accountName: data.details || data.name || `${institutionName} Betaalrekening`,
      status: 'READY',
      bankName: institutionName,
    };
  } catch {
    return {
      id: accountId,
      iban: 'NL00INGB0000000000',
      currency: 'EUR',
      accountName: `${institutionName} Betaalrekening`,
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

  let chosen = balances.find(
    (b) =>
      b.balance_type === 'CLBD' ||
      b.balanceType === 'CLBD' ||
      b.balance_type === 'closingBooked' ||
      b.balanceType === 'closingBooked'
  );
  if (!chosen) {
    chosen =
      balances.find(
        (b) =>
          b.balance_type === 'ITAV' ||
          b.balanceType === 'ITAV' ||
          b.balance_type === 'interimAvailable' ||
          b.balanceType === 'interimAvailable'
      ) || balances[0];
  }

  const rawAmount = chosen?.balance_amount?.amount ?? chosen?.balanceAmount?.amount ?? chosen?.amount ?? '0';
  let amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount || '0'));
  const indicator = chosen?.credit_debit_indicator || chosen?.creditDebitIndicator;
  if (indicator === 'DBIT' && amount > 0) {
    amount = -amount;
  }
  const currency = chosen?.balance_amount?.currency ?? chosen?.balanceAmount?.currency ?? chosen?.currency ?? 'EUR';

  const avail = balances.find(
    (b) =>
      b.balance_type === 'ITAV' ||
      b.balanceType === 'ITAV' ||
      b.balance_type === 'interimAvailable' ||
      b.balanceType === 'interimAvailable'
  );
  const rawAvail = avail?.balance_amount?.amount ?? avail?.balanceAmount?.amount ?? avail?.amount;
  let availAmount = rawAvail !== undefined ? (typeof rawAvail === 'number' ? rawAvail : parseFloat(String(rawAvail))) : null;
  const availIndicator = avail?.credit_debit_indicator || avail?.creditDebitIndicator;
  if (availIndicator === 'DBIT' && availAmount !== null && availAmount > 0) {
    availAmount = -availAmount;
  }

  console.log(`[EnableBanking Balances] Parsed balance: amount=${amount.toFixed(2)}, currency=${currency}`);

  return {
    balance: Number(amount.toFixed(2)),
    availableBalance: availAmount !== null && !isNaN(availAmount) ? Number(availAmount.toFixed(2)) : null,
    currency,
    referenceDate: chosen?.reference_date || chosen?.referenceDate || chosen?.last_change_date_time,
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
  let rawTransactions: any[] = [];
  if (Array.isArray(data)) {
    rawTransactions = data;
  } else if (Array.isArray(data.transactions)) {
    rawTransactions = data.transactions;
  } else if (data.transactions && typeof data.transactions === 'object') {
    const booked = Array.isArray(data.transactions.booked) ? data.transactions.booked : [];
    const pending = Array.isArray(data.transactions.pending) ? data.transactions.pending : [];
    rawTransactions = [...booked, ...pending];
  }

  console.log(`[EnableBanking Transactions] Retrieved count=${rawTransactions.length}`);

  return rawTransactions.map((tx: any) => {
    const rawAmount = tx.transaction_amount?.amount ?? tx.transactionAmount?.amount ?? tx.amount ?? 0;
    let amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount || '0'));
    const indicator = tx.credit_debit_indicator || tx.creditDebitIndicator;
    // Standard banking convention in PayTrack: Debits/expenses are negative
    if (indicator === 'DBIT' && amount > 0) {
      amount = -amount;
    } else if (indicator === 'CRDT' && amount < 0) {
      amount = Math.abs(amount);
    }

    const currency = tx.transaction_amount?.currency ?? tx.transactionAmount?.currency ?? tx.currency ?? 'EUR';

    let remittance: string | null = null;
    if (Array.isArray(tx.remittance_information)) {
      remittance = tx.remittance_information.join(' ');
    } else if (Array.isArray(tx.remittanceInformation)) {
      remittance = tx.remittanceInformation.join(' ');
    } else if (typeof tx.remittance_information === 'string') {
      remittance = tx.remittance_information;
    } else if (typeof tx.remittanceInformation === 'string') {
      remittance = tx.remittanceInformation;
    } else if (tx.remittance_information_unstructured) {
      remittance = tx.remittance_information_unstructured;
    } else if (tx.description) {
      remittance = tx.description;
    }

    const bookingDate =
      tx.booking_date ||
      tx.bookingDate ||
      tx.transaction_date ||
      tx.transactionDate ||
      tx.value_date ||
      tx.valueDate ||
      new Date().toISOString().substring(0, 10);

    const txId =
      tx.entry_reference ||
      tx.entryReference ||
      tx.transaction_id ||
      tx.transactionId ||
      tx.id ||
      `${accountId}_${bookingDate}_${amount}`;

    const isBooked = !tx.status || tx.status === 'BOOK' || tx.status === 'BOOKED' || tx.status === 'booked';

    return {
      transactionId: String(txId),
      amount: Number(amount.toFixed(2)),
      currency,
      bookingDate,
      valueDate: tx.value_date || tx.valueDate || null,
      remittanceInformation: remittance ? remittance.trim() : null,
      creditorName: tx.creditor?.name || tx.creditor_name || tx.creditorName || null,
      debtorName: tx.debtor?.name || tx.debtor_name || tx.debtorName || null,
      status: isBooked ? 'BOOKED' : 'PENDING',
    };
  });
}

/**
 * Revokes and deletes a bank session.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  deleteCachedSession(sessionId);
  try {
    await enableBankingRequest<void>(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  } catch (err: any) {
    // Ignore 404 if session is already expired or deleted externally (idempotent!)
    if (!err.message?.includes('404')) {
      throw err;
    }
  }
}
