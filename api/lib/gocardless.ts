import {
  BankInstitution,
  RequisitionDetails,
  BankAccountDetails,
  BankAccountBalances,
  BankTransactionItem,
} from './types';

const GOCARDLESS_BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2';

// Warm lambda in-memory token cache
let cachedToken: { access: string; expiresAt: number; refresh?: string } | null = null;

export function getSecretCredentials(): { secretId: string; secretKey: string; redirectUri: string } {
  const secretId = process.env.GC_SECRET_ID || '';
  const secretKey = process.env.GC_SECRET_KEY || '';
  const redirectUri = process.env.GC_REDIRECT_URI || '';
  return { secretId, secretKey, redirectUri };
}

export function isMockMode(): boolean {
  const mode = (process.env.BANK_PROVIDER_MODE || 'auto').toLowerCase();
  if (mode === 'mock') return true;
  if (process.env.NODE_ENV === 'production') return false;
  const { secretId, secretKey } = getSecretCredentials();
  return mode === 'auto' && (!secretId || !secretKey);
}

export async function getValidAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 60000) {
    return cachedToken.access;
  }

  const { secretId, secretKey } = getSecretCredentials();
  if (!secretId || !secretKey) {
    throw new Error('GoCardless server credentials (GC_SECRET_ID and GC_SECRET_KEY) are missing.');
  }

  const res = await fetch(`${GOCARDLESS_BASE_URL}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GoCardless token acquisition failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as {
    access: string;
    access_expires: number;
    refresh: string;
    refresh_expires: number;
  };

  cachedToken = {
    access: data.access,
    refresh: data.refresh,
    expiresAt: Date.now() + data.access_expires * 1000,
  };

  return cachedToken.access;
}

async function gocardlessRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getValidAccessToken();
  const url = `${GOCARDLESS_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GoCardless API error [${res.status}] ${endpoint}: ${errText}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export async function getInstitutions(country = 'NL'): Promise<BankInstitution[]> {
  const rawList = await gocardlessRequest<any[]>(`/institutions/?country=${encodeURIComponent(country)}`);

  const list: BankInstitution[] = rawList.map((item) => ({
    id: item.id,
    name: item.name,
    bic: item.bic,
    transactionTotalDays: item.transaction_total_days,
    countries: item.countries || [country],
    logo: item.logo,
  }));

  // Prioritize ING Netherlands
  return list.sort((a, b) => {
    const aIsIng = a.id.toLowerCase().includes('ing') || a.name.toLowerCase().includes('ing');
    const bIsIng = b.id.toLowerCase().includes('ing') || b.name.toLowerCase().includes('ing');
    if (aIsIng && !bIsIng) return -1;
    if (!aIsIng && bIsIng) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  reference: string
): Promise<{ id: string; link: string }> {
  const data = await gocardlessRequest<any>('/requisitions/', {
    method: 'POST',
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      reference,
      user_language: 'NL',
    }),
  });

  return {
    id: data.id,
    link: data.link,
  };
}

export async function getRequisition(requisitionId: string): Promise<RequisitionDetails> {
  const data = await gocardlessRequest<any>(`/requisitions/${encodeURIComponent(requisitionId)}/`);
  return {
    id: data.id,
    status: data.status,
    link: data.link,
    accounts: data.accounts || [],
    institutionId: data.institution_id,
    reference: data.reference,
    createdAt: data.created,
  };
}

export async function getAccountDetails(accountId: string): Promise<BankAccountDetails> {
  const data = await gocardlessRequest<any>(`/accounts/${encodeURIComponent(accountId)}/details/`);
  const acc = data.account || {};

  return {
    id: accountId,
    iban: acc.iban || acc.bban || 'UNKNOWN_IBAN',
    currency: acc.currency || 'EUR',
    ownerName: acc.ownerName,
    accountName: acc.name || 'Betaalrekening',
    status: acc.status || 'READY',
    bankName: 'ING Netherlands',
  };
}

export async function getAccountBalances(accountId: string): Promise<BankAccountBalances> {
  const data = await gocardlessRequest<any>(`/accounts/${encodeURIComponent(accountId)}/balances/`);
  const balances = data.balances || [];

  let selected = balances.find((b: any) => b.balanceType === 'closingBooked');
  if (!selected) {
    selected = balances.find((b: any) => b.balanceType === 'interimAvailable') || balances[0];
  }

  const amount = selected?.balanceAmount?.amount ? parseFloat(selected.balanceAmount.amount) : 0.0;
  const currency = selected?.balanceAmount?.currency || 'EUR';

  const availableBal = balances.find((b: any) => b.balanceType === 'interimAvailable');
  const availableAmount = availableBal?.balanceAmount?.amount ? parseFloat(availableBal.balanceAmount.amount) : null;

  return {
    balance: Number(amount.toFixed(2)),
    availableBalance: availableAmount !== null ? Number(availableAmount.toFixed(2)) : null,
    currency,
    referenceDate: selected?.referenceDate,
  };
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string
): Promise<BankTransactionItem[]> {
  let endpoint = `/accounts/${encodeURIComponent(accountId)}/transactions/`;
  if (dateFrom) {
    endpoint += `?date_from=${encodeURIComponent(dateFrom)}`;
  }

  const data = await gocardlessRequest<any>(endpoint);
  const booked = data.transactions?.booked || [];
  const pending = data.transactions?.pending || [];

  const result: BankTransactionItem[] = [];

  for (const tx of booked) {
    const amount = tx.transactionAmount?.amount ? parseFloat(tx.transactionAmount.amount) : 0.0;
    const currency = tx.transactionAmount?.currency || 'EUR';
    const remittance =
      tx.remittanceInformationUnstructured ||
      (Array.isArray(tx.remittanceInformationUnstructuredArray)
        ? tx.remittanceInformationUnstructuredArray.join(' ')
        : '') ||
      '';

    result.push({
      transactionId: tx.transactionId || tx.internalTransactionId || `${accountId}_${tx.bookingDate}_${amount}`,
      amount: Number(amount.toFixed(2)),
      currency,
      bookingDate: tx.bookingDate || tx.valueDate || new Date().toISOString().substring(0, 10),
      valueDate: tx.valueDate || null,
      remittanceInformation: remittance.trim() || null,
      creditorName: tx.creditorName || null,
      debtorName: tx.debtorName || null,
      status: 'BOOKED',
    });
  }

  for (const tx of pending) {
    const amount = tx.transactionAmount?.amount ? parseFloat(tx.transactionAmount.amount) : 0.0;
    const currency = tx.transactionAmount?.currency || 'EUR';
    const remittance =
      tx.remittanceInformationUnstructured ||
      (Array.isArray(tx.remittanceInformationUnstructuredArray)
        ? tx.remittanceInformationUnstructuredArray.join(' ')
        : '') ||
      '';

    result.push({
      transactionId: tx.transactionId || tx.internalTransactionId || `pending_${accountId}_${amount}`,
      amount: Number(amount.toFixed(2)),
      currency,
      bookingDate: tx.bookingDate || tx.valueDate || new Date().toISOString().substring(0, 10),
      valueDate: tx.valueDate || null,
      remittanceInformation: remittance.trim() || null,
      creditorName: tx.creditorName || null,
      debtorName: tx.debtorName || null,
      status: 'PENDING',
    });
  }

  return result;
}

export async function deleteRequisition(requisitionId: string): Promise<void> {
  try {
    await gocardlessRequest<void>(`/requisitions/${encodeURIComponent(requisitionId)}/`, {
      method: 'DELETE',
    });
  } catch (err: any) {
    if (!err.message?.includes('404')) {
      throw err;
    }
  }
}
