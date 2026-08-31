# PayTrack — Personal Finance

## 1. Purpose

PayTrack tracks the user's personal income, expenses, savings, and financial goals.

The system should make it easy to answer:

- How much did I earn?
- How much did I spend?
- How much did I save?
- How much will I probably save?
- When will I reach my savings goal?

---

# 2. Income

Income can come from:

- Actual payslips
- Estimated salary
- Other manually entered income

Each income record should contain:

```text id="5x7k3n"
Amount
Date
Type
Source
Status
Notes
```

Income status:

```text id="xj7b2m"
Estimated
Actual
```

Actual payslip income takes priority over estimates.

---

# 3. Weekly Income

PayTrack should show:

```text id="e8bq1p"
This week's income
Last week's income
Average weekly income
```

The user should be able to compare estimated and actual weekly income.

---

# 4. Monthly Income

For each month:

```text id="9k3wqa"
Total income
Actual income
Estimated income
Average income
```

Future income should be shown separately from already received income.

Example:

```text id="q2p7cz"
August

Received:     €1,850
Expected:     €750

Expected total:
€2,600
```

---

# 5. Expenses

The user can manually add expenses.

Each expense contains:

```text id="z8f2mx"
Amount
Date
Category
Description
```

Optional:

```text id="w4n6ka"
Merchant
Recurring
Notes
```

---

# 6. Expense Categories

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

Categories should be editable in the future.

---

# 7. Recurring Expenses

The user should be able to mark an expense as recurring.

Example:

```text id="qv2x6j"
Rent       €800/month
Phone       €30/month
Insurance   €38/week
```

Recurring expenses can be used for financial forecasts.

---

# 8. Monthly Expenses

PayTrack should calculate:

```text id="6k9c4v"
Total monthly expenses
```

It should also show expenses by category.

Example:

```text id="z7p2qa"
Housing       €800
Food          €350
Transport     €120
Subscriptions  €40
Other         €190

Total        €1,500
```

---

# 9. Savings

Basic formula:

```text id="b5m8dz"
Savings = Income - Expenses
```

Monthly:

```text id="7v3q9a"
Monthly Savings =
Monthly Income - Monthly Expenses
```

---

# 10. Savings Rate

Formula:

```text id="m4x8pc"
Savings Rate =
Savings / Income × 100
```

Example:

```text id="f3r7kw"
Income:  €2,600
Expenses: €1,500
Savings: €1,100

Savings rate:
42.3%
```

---

# 11. Current Balance / Savings

PayTrack should allow the user to enter an initial savings amount.

Example:

```text id="k9w2qa"
Starting savings: €1,000
```

Future savings can then be tracked over time.

The application should distinguish between:

- Money earned
- Money spent
- Money saved
- Current savings balance

---

# 12. Savings Goals

The user can create a savings goal.

A goal contains:

```text id="p6x3nm"
Name
Target amount
Current amount
Target date
```

Example:

```text id="r8k2vc"
Emergency Fund

Target:  €5,000
Current: €1,800
Progress: 36%
```

---

# 13. Goal Forecast

PayTrack should estimate when a savings goal will be reached.

Example:

```text id="c7m4qa"
Target: €5,000
Current: €1,800
Average monthly savings: €900

Estimated completion:
~4 months
```

This is an estimate, not a guarantee.

---

# 14. Monthly Financial Forecast

PayTrack should estimate future monthly finances using:

- Planned work shifts
- Historical income
- Current hourly rate
- Historical expenses
- Recurring expenses

Example:

```text id="w5k9px"
September forecast

Income:    €2,700
Expenses:  €1,500
Savings:   €1,200
```

---

# 15. Long-Term Forecast

The user should be able to see projected savings over:

- 3 months
- 6 months
- 12 months

Example:

```text id="d4m7qa"
Current savings: €2,000

Estimated monthly savings: €1,000

After 3 months:  €5,000
After 6 months:  €8,000
After 12 months: €14,000
```

The forecast must clearly state that it is an estimate.

---

# 16. Income Variability

Because the user is paid hourly, monthly income can change.

Forecasts should therefore use ranges when useful.

Example:

```text id="v8q2mz"
Expected monthly income:

Low:      €2,200
Typical:  €2,600
High:     €3,000
```

The exact forecasting model can be defined later.

---

# 17. Salary + Expense Connection

PayTrack should connect payroll data with personal finance data.

Example:

```text id="m2x7qc"
Payslip
   ↓
Actual Income
   ↓
Monthly Income
   ↓
Expenses
   ↓
Savings
```

The user should not need to enter the same salary twice.

---

# 18. Bank Integration

Bank integration is a future feature.

If connected, PayTrack may automatically import:

- Account balance
- Salary payments
- Expenses
- Transactions

Imported transactions should not automatically become confirmed expenses without validation where necessary.

---

# 19. ING Integration

ING Netherlands is the initial planned bank.

The integration should use an appropriate Open Banking / PSD2 flow.

PayTrack must never request or store the user's ING password.

Bank integration is **not required for MVP**.

---

# 20. Financial Dashboard

The finance section should show:

```text id="h4v9qa"
Income
Expenses
Savings
Savings Rate
```

For the selected period.

The user should be able to switch between:

```text id="x6m2pw"
Week
Month
Year
```

---

# 21. Historical Data

Historical financial data must not change unexpectedly when payroll settings change.

For example:

Changing the current hourly rate from:

```text id="v3m8qa"
€16.35 → €16.49
```

must not change previous months' actual income.

---

# 22. Actual vs Forecast

PayTrack must clearly distinguish:

```text id="j8q4mx"
ACTUAL
```

from:

```text id="p5v9kc"
ESTIMATED
```

Example:

```text id="a7m3qx"
August income

Actual:    €2,350
Forecast:  €2,600
```

---

# 23. Financial Data Rules

1. Actual payslip income is authoritative.
2. Estimates must never overwrite actual income.
3. Expenses are separate from payroll deductions.
4. Savings are calculated from income and expenses.
5. Forecasts must be clearly labeled.
6. Historical actual data must remain stable.
7. Recurring expenses may be used for forecasts.
8. The user can manually correct financial records.
9. AI must not perform financial calculations.
10. Banking integration is optional and outside the MVP.