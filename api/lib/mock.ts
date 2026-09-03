import {
  BankInstitution,
  RequisitionDetails,
  BankAccountDetails,
  BankAccountBalances,
  BankTransactionItem,
} from './types';

const defaultAccountId = 'acc_mock_ing_001';

export function mockGetInstitutions(): BankInstitution[] {
  return [
    {
      id: 'ING_INGBNL2A',
      name: 'ING Netherlands',
      bic: 'INGBNL2A',
      transactionTotalDays: '730',
      countries: ['NL'],
      logo: 'https://cdn.gocardless.com/institutions/ING_INGBNL2A.png',
    },
    {
      id: 'ABNA_ABNANL2A',
      name: 'ABN AMRO',
      bic: 'ABNANL2A',
      transactionTotalDays: '730',
      countries: ['NL'],
    },
    {
      id: 'RABO_RABONL2U',
      name: 'Rabobank',
      bic: 'RABONL2U',
      transactionTotalDays: '730',
      countries: ['NL'],
    },
    {
      id: 'SNSB_SNSBNL2A',
      name: 'SNS Bank',
      bic: 'SNSBNL2A',
      transactionTotalDays: '730',
      countries: ['NL'],
    },
  ];
}

export function mockCreateRequisition(
  institutionId: string,
  redirectUrl: string,
  reference: string
): { id: string; link: string } {
  const id = `req_mock_${Date.now()}`;
  const sep = redirectUrl.includes('?') ? '&' : '?';
  const link = `${redirectUrl}${sep}ref=${id}&status=success`;
  return { id, link };
}

export function mockGetRequisition(requisitionId: string): RequisitionDetails {
  return {
    id: requisitionId || 'req_mock_default',
    status: 'LN', // Linked
    link: '',
    accounts: [defaultAccountId],
    institutionId: 'ING_INGBNL2A',
    reference: 'ref_mock_user',
    createdAt: new Date().toISOString(),
  };
}

export function mockGetAccountDetails(accountId: string): BankAccountDetails {
  return {
    id: accountId || defaultAccountId,
    iban: 'NL91INGB0001234567',
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
      transactionId: `mock_tx_${currentYear}_spotify`,
      amount: -10.99,
      currency: 'EUR',
      bookingDate: `${currentYear}-${currentMonth}-01`,
      valueDate: `${currentYear}-${currentMonth}-01`,
      remittanceInformation: 'Spotify Premium maandabonnement Sep 2026',
      creditorName: 'Spotify AB',
      debtorName: 'Alper Ozer',
      status: 'BOOKED',
    },
  ];
}
