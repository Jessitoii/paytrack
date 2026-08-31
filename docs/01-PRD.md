# PayTrack — Product Requirements Document

## 1. Product Goal

PayTrack helps hourly workers track their working hours, estimate their salary, understand their actual payslips, track expenses, and monitor their savings.

The product should minimize manual data entry while providing transparent and accurate financial information.

---

## 2. Target User

The initial target user is an hourly worker in the Netherlands who:

- Works variable hours each week
- Has changing shifts
- Receives weekly salary payments
- Receives shift and weekend premiums
- Has variable weekly income
- Wants to track working hours and salary
- Wants to track personal expenses and savings

The initial payroll configuration is based on the user's current Albert Heijn / Carrière employment situation.

---

# 3. Core Features

## 3.1 Dashboard

The dashboard is the main screen.

It should show:

- Today's shift
- Current work status
- Hours worked this week
- Estimated weekly salary
- Actual weekly salary
- Estimated monthly income
- Monthly expenses
- Monthly savings
- Current savings
- Upcoming shifts

The most important information should be visible without navigating through multiple screens.

---

## 3.2 Shift Planning

The user can create and edit weekly shift schedules.

Each shift contains:

- Date
- Start time
- End time
- Shift type
- Break profile
- Optional notes

The user can mark a day as:

- Working
- Off
- Vacation
- Sick
- Other

PayTrack may suggest shifts based on recurring patterns, but the user always has final control.

---

## 3.3 Start Work

The user can press:

**Start Work**

The application records the current time automatically.

The user should not need to manually enter the start time during normal use.

The recorded time can be edited later.

---

## 3.4 Finish Work

The user can press:

**Finish Work**

The application records the current time automatically.

The application applies the configured time-rounding rule used for the user's payroll system.

The user can manually correct the recorded time later.

---

## 3.5 Break Tracking

PayTrack supports:

- 15-minute paid break
- 30-minute unpaid break
- Additional 15-minute paid break

The normal break pattern is:

- 15-minute paid break
- 30-minute unpaid break

The second 15-minute paid break is normally not taken unless work continues longer or overtime occurs.

The user can change the break pattern for an individual shift.

---

## 3.6 Planned vs Actual

PayTrack compares planned and actual working time.

Example:

```text
Planned:
14:30 → 23:00

Actual:
14:32 → 23:23

Paid time:
8h 23m
```

The application should show the difference between planned and actual work.

---

# 4. Payroll Estimation

PayTrack calculates estimated earnings from working records.

The calculation may include:

- Base hourly wage
- Paid working hours
- Shift premiums
- Sunday premiums
- Night premiums
- Holiday-related payments
- ADV compensation
- Other configured payroll components
- Estimated deductions

The result should include:

- Estimated gross income
- Estimated deductions
- Estimated net income

---

## 4.1 Weekly Salary

The application calculates the expected salary for each payroll week.

Example:

```text
Week 35

Worked: 42h 15m
Estimated gross: €XXX
Estimated net: €XXX
```

---

## 4.2 Monthly Salary

The application aggregates weekly income into monthly income.

It should show:

- Actual income
- Estimated future income
- Total monthly income
- Average monthly income

---

## 4.3 Income Forecast

Based on historical working patterns and planned shifts, PayTrack estimates future income.

The application should answer:

> "If I continue working like this, how much will I earn?"

Possible views:

- This week
- This month
- Next month
- 3 months
- 6 months
- 12 months

Forecasts must be clearly marked as estimates.

---

# 5. Payslip Management

The user can upload payslip PDFs.

PayTrack extracts payroll information from the payslip and creates a structured payslip record.

The user should be able to review extracted values before accepting them.

The application should store:

- Payroll period
- Working hours
- Earnings
- Premiums
- Allowances
- Deductions
- Gross salary
- Net salary
- Actual bank payment

---

## 5.1 Estimated vs Actual Salary

After importing a payslip, PayTrack compares:

```text
Estimated salary
        VS
Actual salary
```

The application should highlight differences and identify which payroll components caused the difference when possible.

---

# 6. Expense Tracking

The user can manually add expenses.

Each expense contains:

- Amount
- Date
- Category
- Description
- Optional merchant

The user can edit or delete expenses.

Expenses can be grouped by category and month.

---

# 7. Savings Tracking

PayTrack calculates:

```text
Savings = Income - Expenses
```

The application should show:

- Current savings
- Weekly savings
- Monthly savings
- Average monthly savings
- Savings rate

Example:

```text
Monthly income:   €2,600
Monthly expenses: €1,400

Saved:            €1,200
Savings rate:     46.2%
```

---

# 8. Financial Forecasting

PayTrack uses historical income and expense data to estimate future savings.

The application should provide:

- Expected monthly savings
- Expected yearly savings
- Future balance projections
- Time required to reach savings goals

Example:

> At your current average savings rate, you may save approximately €14,000 over the next 12 months.

Forecasts are estimates and must not be presented as guaranteed results.

---

# 9. Savings Goals

Users can create savings goals.

A goal contains:

- Name
- Target amount
- Current amount
- Optional target date

Example:

```text
Car Fund

Target: €5,000
Current: €1,850
Progress: 37%
```

PayTrack calculates an estimated completion date based on the user's savings rate.

---

# 10. Banking Integration

Banking integration is a planned feature.

The intended initial bank is ING Netherlands.

The user should be able to connect their bank through an appropriate Open Banking / PSD2 authorization flow.

PayTrack should never ask users to provide their ING password directly to PayTrack.

Future banking functionality may include:

- Account balance
- Transaction history
- Automatic salary detection
- Automatic expense detection
- Transaction categorization
- Automatic synchronization

Banking integration is not required for the initial MVP.

---

# 11. AI Features

AI is primarily used to process unstructured information.

Initial AI use cases:

### Payslip parsing

```text
PDF → AI → Structured payroll data
```

### Future schedule parsing

```text
Schedule screenshot/PDF → AI → Weekly shifts
```

### Future transaction categorization

```text
Transaction → AI → Expense category
```

AI should not be responsible for financial arithmetic or payroll calculations.

---

# 12. Analytics

PayTrack should provide basic analytics for:

### Work

- Hours worked
- Average hours per week
- Average hours per month
- Premium hours
- Overtime

### Income

- Weekly income
- Monthly income
- Average income
- Gross vs net
- Estimated vs actual

### Expenses

- Monthly expenses
- Expenses by category
- Average monthly expenses

### Savings

- Monthly savings
- Savings rate
- Savings history
- Forecasted savings

---

# 13. User Experience Requirements

The application should prioritize speed and simplicity.

Common actions should require very few interactions.

Especially:

- Start work
- Finish work
- Add expense
- Add/edit shift
- Upload payslip

The user should not need to understand Dutch payroll terminology to use the application.

Technical payroll terminology can be shown as additional information when useful.

---

# 14. MVP Scope

The MVP must include:

1. Dashboard
2. Weekly shift planning
3. Start Work
4. Finish Work
5. Manual time editing
6. Break management
7. Payroll calculation
8. Weekly salary estimation
9. Monthly salary estimation
10. Payslip PDF upload
11. AI payslip parsing
12. Payslip review and correction
13. Estimated vs actual salary
14. Expense tracking
15. Savings calculation
16. Basic financial forecasting
17. Basic analytics

The following are intentionally outside the initial MVP:

- ING integration
- Automatic bank synchronization
- Advanced AI financial assistant
- Automatic schedule screenshot parsing
- Multiple employers
- Advanced budgeting
- Investment tracking