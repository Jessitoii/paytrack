# PayTrack — Banking Integration

## 1. Purpose

PayTrack may connect to the user's bank account to automatically import financial data.

The initial target bank is **ING Netherlands**.

Banking integration is **not required for MVP**.

---

# 2. Main Goal

The integration should reduce manual data entry.

Without banking:

```text
Salary → Payslip → PayTrack
Expense → Manual entry → PayTrack
```

With banking:

```text
Bank
 ↓
Transactions
 ↓
PayTrack
 ↓
Income / Expenses / Savings
```

---

# 3. Open Banking

PayTrack should use a proper **Open Banking / PSD2** provider.

PayTrack should not connect directly to ING unless the required banking infrastructure is available and appropriate.

The exact provider will be selected during implementation.

---

# 4. Authentication

The user must authenticate with ING through the bank/provider's official authorization flow.

PayTrack must **never ask the user for**:

- ING username
- ING password
- PIN
- One-time authentication codes

PayTrack should receive only the permissions/data required for the integration.

---

# 5. Account Data

If supported by the banking provider, PayTrack may retrieve:

- Account name
- IBAN
- Current balance
- Available balance
- Account currency

The application should store only the data it actually needs.

---

# 6. Transactions

PayTrack may import:

- Transaction date
- Amount
- Currency
- Description
- Counterparty
- Transaction type
- Account

Example:

```text id="q6x3ka"
25 Aug
+€589.90
Salary
```

or:

```text id="m8v2pc"
26 Aug
-€35.40
Albert Heijn
```

---

# 7. Salary Detection

PayTrack should eventually detect salary payments.

Possible signals:

- Positive transaction
- Employer name
- Regular amount
- Regular payment date
- Payroll period

Detected salary payments should be matched against payslips where possible.

The application must not assume that every incoming payment is salary.

---

# 8. Expense Detection

PayTrack may detect outgoing transactions as potential expenses.

Example:

```text id="w4k8qa"
Bank transaction
      ↓
Potential expense
      ↓
Category suggestion
      ↓
User confirmation
```

The system should avoid silently creating incorrect financial records.

---

# 9. Transaction Categorization

Transactions may be categorized automatically.

Initial categories:

- Housing
- Food
- Transportation
- Health
- Shopping
- Bills
- Entertainment
- Subscriptions
- Travel
- Other

AI may be used for categorization in a future version.

---

# 10. Duplicate Prevention

Imported transactions must have a unique identifier when provided by the banking provider.

PayTrack must avoid importing the same transaction multiple times.

If the provider does not provide a stable transaction ID, PayTrack should use a combination of transaction properties to detect likely duplicates.

---

# 11. Sync

The application should support manual and automatic synchronization.

Example:

```text id="y2m7qx"
[Sync Bank]
```

Automatic synchronization may run periodically when supported.

The exact sync frequency depends on the Open Banking provider.

---

# 12. Bank Connection Status

The application should show:

```text id="k5v9mc"
Connected
Last synced: 10 minutes ago
```

Possible states:

```text id="c8q2pa"
Connected
Disconnected
Expired
Needs re-authentication
Error
```

---

# 13. Connection Expiration

Open Banking connections may expire.

When re-authentication is required:

```text id="n7x3qw"
Bank connection expired.

[Reconnect]
```

The application must not treat expired connections as active.

---

# 14. Multiple Accounts

The architecture should allow multiple bank accounts in the future.

For MVP-level banking support, one ING account is sufficient.

Future support may include:

- Multiple ING accounts
- Other Dutch banks
- Revolut
- bunq
- ABN AMRO
- Rabobank

These are not required initially.

---

# 15. Balance

If account balance is available, PayTrack may display:

```text id="p3m8qa"
Bank balance
+
Tracked savings
```

The application must clearly distinguish between:

**Bank balance**

and:

**PayTrack calculated savings.**

They are not necessarily the same.

---

# 16. Bank Data vs Payslip Data

Payslips and bank transactions have different purposes.

### Payslip

Used for:

- Working hours
- Gross salary
- Payroll deductions
- Net salary
- Payroll details

### Bank transaction

Used for:

- Actual money received
- Account balance
- Expenses
- Cash flow

A bank transaction must not replace the detailed payslip.

---

# 17. Salary Reconciliation

Future versions should compare:

```text id="f6q2mx"
Payslip bank payment
        VS
Bank salary transaction
```

Example:

```text id="r8k3qa"
Payslip:       €589.90
Bank payment:  €589.90

Status: MATCH
```

If different:

```text id="t5m9pc"
Payslip:       €589.90
Bank payment:  €580.00

Status: REVIEW
```

---

# 18. Privacy

Bank data is sensitive financial information.

PayTrack must:

- Encrypt sensitive data where appropriate.
- Restrict access to authenticated users.
- Minimize stored banking data.
- Never store bank login credentials.
- Never expose banking data to other users.
- Avoid sending unnecessary transaction data to AI providers.

---

# 19. AI and Banking

AI is optional for banking.

AI may eventually help with:

- Transaction categorization
- Merchant recognition
- Salary detection
- Spending summaries

AI must not:

- Authenticate with the bank
- Handle bank passwords
- Perform financial calculations
- Make transactions
- Transfer money

---

# 20. No Payments

PayTrack is a **read-only financial tracking application**.

The initial banking integration must not:

- Send money
- Make transfers
- Pay bills
- Change standing orders
- Modify bank accounts

---

# 21. Error Handling

If synchronization fails:

```text id="v2q7mx"
Bank sync failed.

Your existing PayTrack data is unchanged.
```

A failed sync must not delete existing transactions or financial records.

---

# 22. Disconnect

The user must be able to disconnect the bank account from PayTrack.

After disconnecting:

- No new transactions should be imported.
- Existing imported records should remain unless the user explicitly deletes them.
- Stored connection credentials/tokens should be revoked or removed as appropriate.

---

# 23. MVP Status

Banking integration is:

**OUT OF MVP**

The MVP must work completely without a bank connection.

Manual income and expense entry must remain available even after banking integration is added.

---

# 24. Core Rules

1. Use Open Banking / PSD2.
2. Never request ING credentials directly.
3. Never store bank passwords.
4. Keep banking read-only.
5. Prevent duplicate transactions.
6. Do not treat every incoming payment as salary.
7. Keep payslip data separate from bank data.
8. Keep actual and estimated financial data separate.
9. Banking failure must not corrupt existing data.
10. Banking integration must be optional.