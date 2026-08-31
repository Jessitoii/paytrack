# PayTrack — Data Model

## 1. Purpose

This document defines the main data entities used by PayTrack.

The model must support:

- Work tracking
- Shift planning
- Payroll
- Payslips
- Expenses
- Savings
- Financial forecasting
- Future banking integration

---

# 2. User

Represents the application user.

```text id="j4q8mx"
User
- id
- name
- email
- timezone
- currency
- created_at
```

Initial timezone:

```text
Europe/Amsterdam
```

Initial currency:

```text
EUR
```

---

# 3. Employer

Represents an employer.

```text id="m7x2qa"
Employer
- id
- name
- country
```

Example:

```text
Albert Heijn
```

---

# 4. Employment

Represents the user's employment relationship.

```text id="p8k3wc"
Employment
- id
- user_id
- employer_id
- agency
- start_date
- end_date
- hourly_rate
- currency
- active
```

Example:

```text
Employer: Albert Heijn
Agency: Carrière
Hourly rate: €16.35
```

Hourly rates must be versioned over time.

---

# 5. Pay Rate

Stores an hourly rate and its effective period.

```text id="v6m9qa"
PayRate
- id
- employment_id
- rate
- effective_from
- effective_until
```

Example:

```text
€16.35
effective until Week 12

€16.49
effective from Week 13
```

Historical records must retain the correct rate.

---

# 6. Shift

Represents a planned shift.

```text id="q3x7mc"
Shift
- id
- user_id
- date
- planned_start
- planned_end
- shift_type
- status
- notes
```

Possible shift types:

```text id="m8k2pa"
morning
afternoon
night
other
```

Possible statuses:

```text id="z4v9qx"
planned
working
completed
cancelled
```

---

# 7. Work Session

Represents actual work.

```text id="c7m3qa"
WorkSession
- id
- shift_id
- user_id
- actual_start
- actual_finish
- rounded_finish
- status
- notes
```

The original finish timestamp and rounded finish timestamp should both be stored.

---

# 8. Break

Represents a break during a work session.

```text id="f9x2mc"
Break
- id
- work_session_id
- type
- start_time
- end_time
- duration_minutes
- paid
```

Possible types:

```text id="w5k8qa"
paid_15
unpaid_30
paid_15_extra
custom
```

---

# 9. Payroll Week

Represents a weekly payroll period.

```text id="n3q7mx"
PayrollWeek
- id
- user_id
- week_number
- start_date
- end_date
- status
```

Possible statuses:

```text id="r8m2vc"
open
estimated
paid
```

---

# 10. Payroll Calculation

Stores a calculated payroll result.

```text id="k6x9qa"
PayrollCalculation
- id
- payroll_week_id
- hourly_rate
- paid_minutes
- base_earnings
- premium_earnings
- adv
- holiday_allowance
- holiday_entitlement
- et_exchange
- gross
- deductions
- estimated_net
- calculated_at
```

This represents PayTrack's calculation.

It is not the same as the actual payslip.

---

# 11. Payroll Component

Individual payroll components should be stored separately when practical.

```text id="q7m3xc"
PayrollComponent
- id
- payroll_calculation_id
- type
- name
- amount
- rate
- calculation_base
```

Examples:

```text
base_salary
evening_premium
sunday_premium
night_premium
adv
holiday_allowance
holiday_entitlement
paww
azv
stipp
wga
loonheffing
et_exchange
```

---

# 12. Payslip

Represents an actual payslip.

```text id="x5k8mq"
Payslip
- id
- user_id
- employment_id
- payroll_week_id
- file_id
- payroll_period_start
- payroll_period_end
- total_gross
- total_net
- bank_payment
- imported_at
```

---

# 13. Payslip Component

Stores values extracted from the actual payslip.

```text id="m2q7va"
PayslipComponent
- id
- payslip_id
- type
- name
- amount
- rate
- calculation_base
```

The extracted values should remain separate from PayTrack's calculated values.

---

# 14. Payslip Extraction

Stores AI parsing information.

```text id="c8x3mq"
PayslipExtraction
- id
- payslip_id
- provider
- model
- status
- extracted_data
- confidence
- created_at
```

Possible statuses:

```text id="v4m9qa"
pending
completed
failed
reviewed
```

---

# 15. Expense

Represents a personal expense.

```text id="p7x2mc"
Expense
- id
- user_id
- amount
- currency
- date
- category
- description
- merchant
- recurring
- created_at
```

---

# 16. Expense Category

Categories should be configurable.

Initial categories:

```text id="q9m4xa"
Housing
Food
Transportation
Health
Shopping
Bills
Entertainment
Subscriptions
Travel
Other
```

---

# 17. Recurring Expense

Recurring expenses may be represented through the Expense entity or a dedicated recurring model.

If a dedicated model is used:

```text id="m6x8qa"
RecurringExpense
- id
- user_id
- name
- amount
- category
- frequency
- next_date
- active
```

---

# 18. Income Record

Represents income used by the personal-finance system.

```text id="z3q7mc"
Income
- id
- user_id
- amount
- date
- source
- type
- status
- payslip_id
```

Possible status:

```text id="v8m2qa"
estimated
actual
```

A payslip-based income record should reference the corresponding payslip.

---

# 19. Savings Goal

Represents a financial target.

```text id="k4x9mq"
SavingsGoal
- id
- user_id
- name
- target_amount
- current_amount
- target_date
- created_at
- active
```

Example:

```text
Emergency Fund
Target: €5,000
Current: €1,800
```

---

# 20. Bank Account

Future entity for banking integration.

```text id="q6m3xa"
BankAccount
- id
- user_id
- provider
- bank_name
- iban
- currency
- balance
- connection_status
```

---

# 21. Bank Transaction

Future entity for imported transactions.

```text id="x8v2mc"
BankTransaction
- id
- bank_account_id
- external_id
- date
- amount
- currency
- description
- counterparty
- type
- category
- imported_at
```

`external_id` should be used for duplicate detection when available.

---

# 22. Financial Forecast

Represents a calculated future projection.

```text id="m5q9xa"
FinancialForecast
- id
- user_id
- period_start
- period_end
- projected_income
- projected_expenses
- projected_savings
- confidence
- created_at
```

Forecasts are estimates and must never overwrite actual financial records.

---

# 23. Payroll Configuration

Payroll rules must be configurable rather than hard-coded.

```text id="v7x3mq"
PayrollConfiguration
- id
- employment_id
- hourly_rate
- premium_rules
- deduction_rules
- allowance_rules
- rounding_rules
- effective_from
- effective_until
```

This allows payroll rules to change without changing historical calculations.

---

# 24. Relationships

Main relationships:

```text id="k9m4qc"
User
 │
 ├── Employment
 │      └── Employer
 │
 ├── Shifts
 │      └── Work Sessions
 │             └── Breaks
 │
 ├── Payroll Weeks
 │      ├── Payroll Calculations
 │      │      └── Payroll Components
 │      │
 │      └── Payslips
 │             ├── Payslip Components
 │             └── AI Extraction
 │
 ├── Income
 │
 ├── Expenses
 │
 ├── Savings Goals
 │
 ├── Financial Forecasts
 │
 └── Bank Accounts
        └── Bank Transactions
```

---

# 25. Actual vs Calculated Data

This separation is important.

### Calculated

```text
PayrollCalculation
FinancialForecast
```

### Actual

```text
Payslip
PayslipComponent
BankTransaction
```

### User-entered

```text
Shift
WorkSession
Expense
SavingsGoal
```

Actual data must not be overwritten by estimates.

---

# 26. Historical Data

Historical payroll records must preserve the rules used at the time.

For example:

```text
Week 12 → €16.35
Week 13 → €16.49
```

Changing the current rate must not modify Week 12.

---

# 27. Data Principles

1. Keep actual and estimated data separate.
2. Keep planned and actual work separate.
3. Keep payslip data separate from calculations.
4. Keep payroll components separate.
5. Keep historical payroll rules immutable.
6. Store original timestamps before rounding.
7. Store rounded timestamps separately.
8. AI extraction must be reviewable.
9. User corrections must be preserved.
10. Banking data must be optional.
11. Financial forecasts must never overwrite actual data.
12. Payroll configuration must be versioned.