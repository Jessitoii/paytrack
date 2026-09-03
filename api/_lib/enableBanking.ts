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

  let sessionId = res.session_id;
  if (!sessionId && res.url) {
    try {
      const parsed = new URL(res.url);
      sessionId = parsed.searchParams.get('sessionid') || undefined;
    } catch (_) {}
  }

  return {
    url: res.url,
    sessionId,
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
