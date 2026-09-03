import {
  BankInstitution,
  BankSessionDetails,
  BankAccountDetails,
  BankAccountBalances,
  BankTransactionItem,
} from './types';

const defaultAccountId = 'NL91INGB0001234567';

export function mockGetInstitutions(): BankInstitution[] {
  return [
    {
      id: 'ING',
      name: 'ING Netherlands',
      bic: 'INGBNL2A',
      countries: ['NL'],
      logo: 'https://cdn.enablebanking.com/aspsps/ING.png',
    },
    {
      id: 'ABN AMRO',
      name: 'ABN AMRO',
      bic: 'ABNANL2A',
      countries: ['NL'],
    },
    {
      id: 'Rabobank',
      name: 'Rabobank',
      bic: 'RABONL2U',
      countries: ['NL'],
    },
    {
      id: 'SNS',
      name: 'SNS Bank',
      bic: 'SNSBNL2A',
      countries: ['NL'],
    },
  ];
}

export function mockStartAuthorization(
  aspspName: string = 'ING',
  redirectUrl: string,
  state: string
): { url: string; sessionId: string } {
  const sessionId = `mock_session_${Date.now()}`;
  const sep = redirectUrl.includes('?') ? '&' : '?';
  const url = `${redirectUrl}${sep}code=mock_auth_code_123&state=${encodeURIComponent(state)}&session_id=${sessionId}`;
  return { url, sessionId };
}

// Backward compatibility alias
export function mockCreateRequisition(
  institutionId: string,
  redirectUrl: string,
  reference: string
): { id: string; link: string } {
  const { url, sessionId } = mockStartAuthorization(institutionId, redirectUrl, reference);
  return { id: sessionId, link: url };
}

export function mockExchangeCodeForSession(code: string): BankSessionDetails {
  return {
    id: `session_${code || 'mock'}`,
    status: 'AUTHORIZED',
    accounts: [defaultAccountId],
    rawAccounts: [
      {
        uid: defaultAccountId,
        account_id: { iban: defaultAccountId },
        currency: 'EUR',
        party_name: 'Alper Ozer',
      },
    ],
    institutionId: 'ING',
    institutionName: 'ING Netherlands',
    createdAt: new Date().toISOString(),
  };
}

export function mockGetSession(sessionId: string): BankSessionDetails {
  return {
    id: sessionId || 'session_mock_default',
    status: 'AUTHORIZED',
    accounts: [defaultAccountId],
    rawAccounts: [
      {
        uid: defaultAccountId,
        account_id: { iban: defaultAccountId },
        currency: 'EUR',
        party_name: 'Alper Ozer',
      },
    ],
    institutionId: 'ING',
    institutionName: 'ING Netherlands',
    createdAt: new Date().toISOString(),
  };
}

// Backward compatibility alias
export const mockGetRequisition = mockGetSession;

export function mockGetAccountDetails(accountId: string): BankAccountDetails {
  const cleanId = accountId || defaultAccountId;
  return {
    id: cleanId,
    iban: cleanId.startsWith('NL') ? cleanId : `NL91INGB0001234567`,
    currency: 'EUR',
    ownerName: 'Alper Ozer',
    accountName: 'ING Oranje Betaalpas',
    status: 'READY',
    bankName: 'ING Netherlands',
  };
}

export function mockGetAccountBalances(_accountId: string): BankAccountBalances {
  return {
    balance: 1845.5,
    availableBalance: 1845.5,
    currency: 'EUR',
    referenceDate: new Date().toISOString().substring(0, 10),
  };
}

export function mockGetAccountTransactions(_accountId: string): BankTransactionItem[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  return [
    {
      transactionId: `mock_tx_${currentYear}_salary_w34`,
      amount: 485.75,
      currency: 'EUR',
      bookingDate: `${currentYear}-${currentMonth}-02`,
      valueDate: `${currentYear}-${currentMonth}-02`,
      remittanceInformation: 'Salaris Week 34 Carrière Personeelsdiensten B.V. Loonbetaling',
      creditorName: 'Alper Ozer',
      debtorName: 'Carrière Personeelsdiensten B.V.',
      status: 'BOOKED',
    },
    {
      transactionId: `mock_tx_${currentYear}_rent_mon`,
      amount: -160.0,
      currency: 'EUR',
      bookingDate: `${currentYear}-${currentMonth}-01`,
      valueDate: `${currentYear}-${currentMonth}-01`,
      remittanceInformation: 'Wekelijkse huur / Weekly Rent Monday Housing Bleiswijk',
      creditorName: 'Huisvesting Bleiswijk / Rent',
      debtorName: 'Alper Ozer',
      status: 'BOOKED',
    },
    {
      transactionId: `mock_tx_${currentYear}_ah_groceries`,
      amount: -34.8,
      currency: 'EUR',
      bookingDate: `${currentYear}-${currentMonth}-02`,
      valueDate: `${currentYear}-${currentMonth}-02`,
      remittanceInformation: 'Betaalautomaat 14:15 Pasnr 012 Albert Heijn 1452 Bleiswijk',
      creditorName: 'Albert Heijn Bleiswijk',
      debtorName: 'Alper Ozer',
      status: 'BOOKED',
    },
    {
      transactionId: `mock_tx_${currentYear}_ns_reizigers`,
      amount: -14.6,
      currency: 'EUR',
      bookingDate: `${currentYear}-${currentMonth}-02`,
      valueDate: `${currentYear}-${currentMonth}-02`,
      remittanceInformation: 'NS Reizigers OV-chipkaart automatisch opladen Utrecht CS',
      creditorName: 'NS Groep N.V.',
      debtorName: 'Alper Ozer',
      status: 'BOOKED',
    },
    {
      transactionId: `mock_tx_${currentYear}_kruidvat`,
      amount: -12.49,
      currency: 'EUR',
      bookingDate: `${currentYear}-${currentMonth}-01`,
      valueDate: `${currentYear}-${currentMonth}-01`,
      remittanceInformation: 'Betaalautomaat 18:02 Pasnr 012 Kruidvat 3892',
      creditorName: 'Kruidvat Retail B.V.',
      debtorName: 'Alper Ozer',
      status: 'BOOKED',
    },
    {
      transactionId: `mock_tx_${currentYear}_hollandzorg`,
      amount: -38.01,
      currency: 'EUR',
      bookingDate: `${currentYear}-${currentMonth}-01`,
      valueDate: `${currentYear}-${currentMonth}-01`,
      remittanceInformation: 'Premie HollandZorg basisverzekering weekinhouding',
      creditorName: 'HollandZorg Premie Incasso',
      debtorName: 'Alper Ozer',
      status: 'BOOKED',
    },
    {
      transactionId: `mock_tx_${currentYear}_mediamarkt_160`,
      amount: -160.0,
      currency: 'EUR',
      bookingDate: `${currentYear}-${currentMonth}-01`,
      valueDate: `${currentYear}-${currentMonth}-01`,
      remittanceInformation: 'Betaalautomaat MediaMarkt Rotterdam Centrum Pasnr 012',
      creditorName: 'MediaMarkt Saturn Holding Nederland',
      debtorName: 'Alper Ozer',
      status: 'BOOKED',
    },
  ];
}
