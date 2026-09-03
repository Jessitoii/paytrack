export const SCHEMA_VERSION = 4;

export const CREATE_TABLES_SQL = `
-- 1. User Profile & Settings
CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  currency TEXT NOT NULL DEFAULT 'EUR',
  initialSavings REAL NOT NULL DEFAULT 0.0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- 2. Employer & Employment
CREATE TABLE IF NOT EXISTS employments (
  id TEXT PRIMARY KEY,
  employerName TEXT NOT NULL,
  agencyName TEXT,
  role TEXT DEFAULT 'Order Picker',
  location TEXT DEFAULT 'Bleiswijk',
  country TEXT NOT NULL DEFAULT 'NL',
  startDate TEXT NOT NULL,
  endDate TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- 3. Versioned Payroll Configurations
CREATE TABLE IF NOT EXISTS payroll_configurations (
  id TEXT PRIMARY KEY,
  employmentId TEXT NOT NULL,
  name TEXT NOT NULL,
  effectiveFromDate TEXT NOT NULL,
  effectiveUntilDate TEXT,
  effectiveFromWeek INTEGER NOT NULL,
  effectiveUntilWeek INTEGER,
  baseHourlyRate REAL NOT NULL,
  advHourlyRate REAL,
  advPercentage REAL,
  holidayAllowancePercentage REAL NOT NULL DEFAULT 8.0,
  holidayEntitlementPercentage REAL NOT NULL DEFAULT 10.49777,
  pawwRatePercentage REAL NOT NULL DEFAULT 0.1,
  azvRatePercentage REAL NOT NULL DEFAULT 0.7,
  stippRatePercentage REAL NOT NULL DEFAULT 7.5,
  wgaRatePercentage REAL NOT NULL DEFAULT 0.405,
  healthInsuranceWeekly REAL NOT NULL DEFAULT 38.01,
  additionalInsuranceWeekly REAL NOT NULL DEFAULT 2.76,
  taxEstimationMode TEXT NOT NULL DEFAULT 'CONFIGURABLE_RATE',
  estimatedTaxRatePercentage REAL DEFAULT 18.0,
  isDefault INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (employmentId) REFERENCES employments (id) ON DELETE CASCADE
);

-- 4. Shifts & Work Sessions
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  employmentId TEXT NOT NULL,
  date TEXT NOT NULL,
  shiftType TEXT NOT NULL,
  plannedStart TEXT,
  plannedEnd TEXT,
  startAdjustmentMinutes INTEGER NOT NULL DEFAULT 0,
  expectedActualStart TEXT,
  isDayOff INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (employmentId) REFERENCES employments (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts (date);

CREATE TABLE IF NOT EXISTS work_sessions (
  id TEXT PRIMARY KEY,
  shiftId TEXT,
  actualStart TEXT NOT NULL,
  rawFinish TEXT,
  roundedFinish TEXT,
  elapsedMinutes INTEGER NOT NULL DEFAULT 0,
  paidMinutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  isManualEntry INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (shiftId) REFERENCES shifts (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_start ON work_sessions (actualStart);

CREATE TABLE IF NOT EXISTS work_breaks (
  id TEXT PRIMARY KEY,
  workSessionId TEXT NOT NULL,
  type TEXT NOT NULL,
  durationMinutes INTEGER NOT NULL,
  isPaid INTEGER NOT NULL,
  name TEXT,
  startTime TEXT,
  endTime TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (workSessionId) REFERENCES work_sessions (id) ON DELETE CASCADE
);

-- 5. Weekly Payroll Records
CREATE TABLE IF NOT EXISTS payroll_weeks (
  id TEXT PRIMARY KEY,
  employmentId TEXT NOT NULL,
  year INTEGER NOT NULL,
  weekNumber INTEGER NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ESTIMATED',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(year, weekNumber),
  FOREIGN KEY (employmentId) REFERENCES employments (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payroll_calculations (
  id TEXT PRIMARY KEY,
  payrollWeekId TEXT NOT NULL UNIQUE,
  configSnapshotJson TEXT NOT NULL,
  paidMinutes INTEGER NOT NULL,
  paidHours REAL NOT NULL,
  baseHourlyRate REAL NOT NULL,
  baseGross REAL NOT NULL,
  advAllowance REAL NOT NULL,
  holidayAllowance REAL NOT NULL,
  holidayEntitlementAccrual REAL NOT NULL,
  holidayDaysExchange REAL NOT NULL,
  etExchangeDeduction REAL NOT NULL,
  totalGross REAL NOT NULL,
  pawwDeduction REAL NOT NULL,
  azvDeduction REAL NOT NULL,
  stippDeduction REAL NOT NULL,
  wgaDeduction REAL NOT NULL,
  totalPayrollDeductions REAL NOT NULL,
  loonSv REAL NOT NULL,
  estimatedTax REAL NOT NULL,
  taxAccuracy TEXT NOT NULL,
  netBeforeAdjustments REAL NOT NULL,
  etExchangeReimbursement REAL NOT NULL,
  healthInsurance REAL NOT NULL,
  additionalInsurance REAL NOT NULL,
  estimatedNet REAL NOT NULL,
  estimatedBankPayment REAL NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (payrollWeekId) REFERENCES payroll_weeks (id) ON DELETE CASCADE
);

-- 6. Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id TEXT PRIMARY KEY,
  employmentId TEXT NOT NULL,
  fileName TEXT NOT NULL,
  localFileUri TEXT,
  periodStart TEXT NOT NULL,
  periodEnd TEXT NOT NULL,
  totalGross REAL NOT NULL,
  totalNet REAL NOT NULL,
  bankPayment REAL NOT NULL,
  parsingStatus TEXT NOT NULL DEFAULT 'PARSED',
  extractedDataJson TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (employmentId) REFERENCES employments (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payslip_components (
  id TEXT PRIMARY KEY,
  payslipId TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  percentage REAL,
  hourlyRate REAL,
  hours REAL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (payslipId) REFERENCES payslips (id) ON DELETE CASCADE
);

-- 7. Personal Finance
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  isDefault INTEGER NOT NULL DEFAULT 1,
  isActive INTEGER NOT NULL DEFAULT 1,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  categoryId TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  isRecurring INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (categoryId) REFERENCES expense_categories (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id TEXT PRIMARY KEY,
  categoryId TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'MONTHLY',
  dayOfMonth INTEGER NOT NULL DEFAULT 1,
  dayOfWeek INTEGER DEFAULT 1,
  startDate TEXT NOT NULL,
  endDate TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (categoryId) REFERENCES expense_categories (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  targetAmount REAL NOT NULL,
  currentAmount REAL NOT NULL DEFAULT 0.0,
  priorityOrder INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  monthlyTarget REAL,
  notes TEXT,
  targetDate TEXT,
  color TEXT NOT NULL DEFAULT '#10B981',
  icon TEXT NOT NULL DEFAULT 'target',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- 8. Payroll Calibrations & History
CREATE TABLE IF NOT EXISTS payroll_calibrations (
  id TEXT PRIMARY KEY,
  employmentId TEXT NOT NULL,
  parameterName TEXT NOT NULL,
  oldValue REAL NOT NULL,
  suggestedValue REAL NOT NULL,
  sampleCount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  appliedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (employmentId) REFERENCES employments (id) ON DELETE CASCADE
);

-- 9. Open Banking (GoCardless & ING Netherlands)
CREATE TABLE IF NOT EXISTS bank_connections (
  id TEXT PRIMARY KEY,
  institutionId TEXT NOT NULL,
  institutionName TEXT NOT NULL,
  requisitionId TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'CONNECTED',
  lastSyncedAt TEXT,
  expiresAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  connectionId TEXT NOT NULL,
  gocardlessAccountId TEXT NOT NULL UNIQUE,
  iban TEXT NOT NULL,
  accountName TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  balance REAL NOT NULL DEFAULT 0.0,
  availableBalance REAL,
  bankName TEXT DEFAULT 'ING Netherlands',
  status TEXT NOT NULL DEFAULT 'READY',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (connectionId) REFERENCES bank_connections (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_conn ON bank_accounts (connectionId);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  bankAccountId TEXT NOT NULL,
  gocardlessTransactionId TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  bookingDate TEXT NOT NULL,
  valueDate TEXT,
  remittanceInformation TEXT,
  creditorName TEXT,
  debtorName TEXT,
  categoryId TEXT,
  status TEXT NOT NULL DEFAULT 'BOOKED',
  isRentMatch INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'BANK',
  createdAt TEXT NOT NULL,
  UNIQUE(bankAccountId, gocardlessTransactionId),
  FOREIGN KEY (bankAccountId) REFERENCES bank_accounts (id) ON DELETE CASCADE,
  FOREIGN KEY (categoryId) REFERENCES expense_categories (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions (bookingDate);
CREATE INDEX IF NOT EXISTS idx_bank_tx_account ON bank_transactions (bankAccountId);
`;
