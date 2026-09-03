export interface BankInstitution {
  id: string;
  name: string;
  bic?: string;
  transactionTotalDays?: string;
  countries: string[];
  logo?: string;
}

export interface RequisitionDetails {
  id: string;
  status: string; // 'CR' (Created), 'LN' (Linked), 'EX' (Expired), etc.
  link: string;
  accounts: string[];
  institutionId: string;
  reference: string;
  createdAt?: string;
}

export interface BankAccountDetails {
  id: string;
  iban: string;
  currency: string;
  ownerName?: string;
  accountName?: string;
  status: string;
  bankName: string;
}

export interface BankAccountBalances {
  balance: number;
  availableBalance?: number | null;
  currency: string;
  referenceDate?: string;
}

export interface BankTransactionItem {
  transactionId: string;
  amount: number;
  currency: string;
  bookingDate: string;
  valueDate?: string;
  remittanceInformation?: string;
  creditorName?: string;
  debtorName?: string;
  status: string; // 'BOOKED' | 'PENDING'
}
