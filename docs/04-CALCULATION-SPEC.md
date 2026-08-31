# PayTrack — Calculation Specification

## 1. Purpose

This document defines how PayTrack calculates working time, payroll estimates, income, expenses, and savings.

All calculations must be deterministic.

AI must not perform financial calculations.

---

# 2. Time Units

Internally, working time should be calculated in **minutes**.

Example:

```text
06:00 → 14:30 = 510 minutes
```

Convert to hours only when displaying results.

---

# 3. Finish-Time Rounding

When the user finishes work, round the recorded finish time up to the next 5-minute boundary.

```text
23:21 → 23:25
23:22 → 23:25
23:23 → 23:25
23:24 → 23:25
23:25 → 23:25
```

Formula:

```text
rounded_finish =
ceil(finish_minutes / 5) × 5
```

This rule currently applies only to finish time.

---

# 4. Paid Working Time

Basic formula:

```text
Paid Time =
Elapsed Time
- Unpaid Breaks
+ Paid Breaks
```

Paid breaks are already part of elapsed working time and must not be subtracted.

Therefore, if a shift is:

```text
14:30 → 23:25
```

and contains:

```text
30 min unpaid break
```

then:

```text
Elapsed = 8h 55m
Paid Time = 8h 25m
```

---

# 5. Break Calculation

### Paid break

```text
15 minutes = 15 paid minutes
```

No deduction.

### Unpaid break

```text
30 minutes = 30 unpaid minutes
```

Subtract from paid time.

### Second paid break

```text
15 minutes = 15 paid minutes
```

Only included when the user records that the break was taken.

---

# 6. Base Earnings

For a period:

```text
Base Earnings =
Paid Hours × Hourly Rate
```

Example:

```text
40 hours × €16.35
= €654.00
```

---

# 7. Premium Calculation

Premiums are calculated from the applicable base hourly rate.

### +50%

```text
Premium Rate = Base Rate × 1.50
```

### +75%

```text
Premium Rate = Base Rate × 1.75
```

### +100%

```text
Premium Rate = Base Rate × 2.00
```

Only the applicable premium rule should be applied.

The system must not assume that premiums stack unless explicitly configured.

---

# 8. Time-Based Premiums

A work session must be split when different premium rates apply during the same session.

Example:

```text
21:00 → 23:00
```

If:

```text
21:00–22:00 = normal
22:00–23:00 = +50%
```

then calculate separately:

```text
1h × Base Rate
+
1h × Base Rate × 1.50
```

The calculation engine must support crossing:

- 22:00
- 00:00
- Sunday boundary
- Night-premium boundaries

---

# 9. Sunday Premium

For Sunday work:

```text
Sunday Rate = Base Rate × 1.50
```

For Sunday 22:00–00:00:

```text
Sunday Evening Rate = Base Rate × 1.75
```

The exact premium boundaries must come from the configured payroll profile.

---

# 10. Night Premium

For configured night-premium periods:

```text
Night Rate = Base Rate × 2.00
```

The exact night period must be configurable.

Do not hard-code the night period until verified.

---

# 11. Weekly Gross Estimate

Weekly gross earnings are the sum of all applicable payroll components.

Basic structure:

```text
Gross Estimate =
Base Earnings
+ Premium Earnings
+ ADV
+ Holiday Allowance
+ Holiday Entitlement
+ Other Applicable Earnings
- ET Exchange
```

Each component must be calculated separately.

---

# 12. ADV

Current payroll profile:

```text
ADV = applicable base × 9.005%
```

The exact calculation base must remain configurable.

Do not assume that every future employer uses the same rule.

---

# 13. Holiday Allowance

Current payroll profile:

```text
Holiday Allowance = applicable base × 8%
```

The exact calculation base must be configurable.

---

# 14. Holiday Entitlement

Current payroll profile:

```text
Holiday Entitlement = applicable base × 10.49777%
```

This represents accrued holiday entitlement.

It must be tracked separately from ordinary salary.

---

# 15. ET Exchange

ET exchange is represented as a payroll adjustment.

Basic model:

```text
Taxable Gross
=
Gross Earnings - ET Exchange
```

Then:

```text
Net Adjustment
=
Tax-Free ET Amount
```

The exact ET limits and calculation rules are configurable.

---

# 16. Payroll Deductions

Known payroll deductions:

```text
PAWW       = 0.10%
AZV        = 0.70%
StiPP      = 7.50%
WGA / Whk  = 0.405%
```

Each deduction has its own calculation base.

The application must store the calculation base separately.

Example:

```text
StiPP Deduction =
StiPP Base × 7.50%
```

Do not calculate every deduction from total gross salary.

---

# 17. Income Tax

Income tax is not calculated using a simple fixed percentage.

The payroll profile must support:

- Loonheffing
- Loonheffingskorting
- Loonheffing bijzonder tarief

The exact tax calculation method must be defined separately once verified.

Until then, the tax calculation must be treated as configurable.

---

# 18. Fixed Weekly Deductions

Current payroll profile:

```text
Zorg en Zekerheid = €38.01/week
Additional insurance = €2.76/week
```

These are currently treated as fixed weekly deductions.

---

# 19. Estimated Net Salary

Conceptually:

```text
Estimated Net =
Gross Salary
- Payroll Deductions
- Income Tax
+ Tax-Free Adjustments
- Net Deductions
```

The calculation engine must expose every component.

Do not return only one unexplained number.

---

# 20. Weekly Salary

Weekly salary is calculated from all work records belonging to the payroll week.

```text
Weekly Salary =
Σ Work Session Earnings
+ Weekly Payroll Components
- Weekly Deductions
```

---

# 21. Monthly Income

Monthly income is the sum of weekly payroll records whose payment/payroll period belongs to the selected month.

The system must distinguish:

```text
Actual Income
Estimated Income
```

Actual payslip data takes priority over estimates.

---

# 22. Savings

Basic calculation:

```text
Savings = Income - Expenses
```

Monthly savings:

```text
Monthly Savings =
Monthly Income - Monthly Expenses
```

Savings rate:

```text
Savings Rate =
Monthly Savings / Monthly Income × 100
```

If income is zero, savings rate must not produce a division-by-zero error.

---

# 23. Forecasting

Future income should use:

- Planned shifts
- Historical working hours
- Historical payroll
- Current hourly rate
- Known payroll rules

Future expenses should use:

- Recurring expenses
- Historical average expenses
- Manually entered future expenses

Projected savings:

```text
Projected Savings =
Projected Income - Projected Expenses
```

Forecasts must be labeled as estimates.

---

# 24. Estimate vs Actual

For every completed payroll period:

```text
Difference =
Actual Amount - Estimated Amount
```

Percentage difference:

```text
Difference % =
Difference / Estimated Amount × 100
```

The application should show the difference for:

- Hours
- Gross salary
- Net salary
- Premiums
- Deductions

---

# 25. Historical Data

Historical payslips must preserve:

- Hourly rate
- Payroll rules
- Deduction rates
- Payroll components
- Actual gross
- Actual net
- Actual payment

Changing current payroll settings must not change historical results.

---

# 26. Rounding

Calculations should retain sufficient precision internally.

Currency values should normally be displayed to **2 decimal places**.

Intermediate calculations should not be prematurely rounded.

Final monetary values should be rounded according to the applicable payroll calculation rules.

---

# 27. Reference Tests

The calculation engine must support the following reference results.

### Week 33

```text
Working time: 31h 30m
Gross: €556.54
Bank payment: €453.23
```

### Week 34

```text
Working time: 43h 55m
Gross: €775.90
Bank payment: €589.90
```

These values are reference points for testing.

The calculation engine must not be considered payroll-accurate merely because it matches these two examples. Additional payslips should be used to validate the rules.

---

# 28. Calculation Principles

1. Use minutes internally for time.
2. Use deterministic formulas.
3. Keep payroll components separate.
4. Keep calculation bases separate.
5. Do not let AI perform calculations.
6. Do not silently invent unknown payroll rules.
7. Keep historical payroll rules immutable.
8. Keep payroll configuration editable.
9. Show calculation breakdowns to the user.
10. Validate estimates against real payslips.