export interface BankInstitution {
  id: string;
  name: string;
  bic?: string;
  transactionTotalDays?: string;
  countries: string[];
  logo?: string;
}

export interface BankSessionDetails {
  id: string;
  status: string; // 'AUTHORIZED' | 'LINKED' | 'EXPIRED' | 'DISCONNECTED'
  link?: string;
  accounts: string[];
  rawAccounts?: any[];
  institutionId: string;
  institutionName: string;
  reference?: string;
  createdAt?: string;
}

// Backward compatibility alias
export type RequisitionDetails = BankSessionDetails;

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
  valueDate?: string | null;
  remittanceInformation?: string | null;
  creditorName?: string | null;
  debtorName?: string | null;
  status: string; // 'BOOKED' | 'PENDING'
}
