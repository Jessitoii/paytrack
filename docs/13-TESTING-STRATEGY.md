# PayTrack — Testing Strategy

## 1. Goal

PayTrack handles money and working hours.

Incorrect calculations are unacceptable.

Testing must focus especially on:

- Time calculations
- Break calculations
- Premiums
- Payroll calculations
- Payslip parsing
- Financial calculations
- Historical data

---

# 2. Testing Levels

PayTrack should use:

```text
Unit Tests
Integration Tests
End-to-End Tests
```

Do not add unnecessary testing infrastructure.

---

# 3. Unit Tests

Unit tests should cover isolated business logic.

Most important:

### Time

- Start/end calculation
- 5-minute finish rounding
- Midnight crossing
- Shift duration
- Break subtraction

### Payroll

- Hourly rate
- Premiums
- ADV
- Holiday allowance
- Holiday entitlement
- Deductions
- Gross
- Estimated net

### Finance

- Income
- Expenses
- Savings
- Savings rate
- Forecast calculations

---

# 4. Finish-Time Rounding Tests

The 5-minute rounding rule must have explicit tests.

Examples:

```text
23:21 → 23:25
23:22 → 23:25
23:23 → 23:25
23:24 → 23:25
23:25 → 23:25
```

Also test:

```text
23:26 → 23:30
23:29 → 23:30
23:30 → 23:30
```

---

# 5. Break Tests

Test:

```text
15 min paid break
30 min unpaid break
15 min paid extra break
```

Example:

```text
06:00 → 14:30
Unpaid break: 30 min

Paid time = 8 hours
```

Paid breaks must not reduce paid time.

The second paid break must only be included when the user records it.

---

# 6. Midnight Tests

Test:

```text
23:00 → 06:00
```

Expected:

```text
7 hours elapsed
```

Also test premium calculations when a shift crosses:

```text
Saturday → Sunday
Sunday → Monday
22:00 → 00:00
23:00 → 06:00
```

---

# 7. Premium Tests

Premium calculations must be tested independently.

Test:

- Evening premium
- Sunday premium
- Sunday evening premium
- Night premium

The exact percentages come from the payroll rules.

Tests must verify that only the applicable time receives the premium.

---

# 8. Payroll Test Cases

Create realistic weekly payroll scenarios.

At minimum:

### Scenario A — Short Week

```text
31h 30m
```

Compare the calculation with Week 33 payslip data.

### Scenario B — Full Week

```text
43h 55m
```

Compare the calculation with Week 34 payslip data.

### Scenario C — Evening Work

Include work after 22:00.

### Scenario D — Sunday Work

Include Sunday hours.

### Scenario E — Night Shift

Include a shift crossing midnight.

### Scenario F — Overtime

Work beyond the planned shift.

---

# 9. Payslip Parser Tests

The AI parser must be tested using real and representative payslips.

The test set should contain:

- Different weekly hours
- Different shift premiums
- Different deductions
- Different payroll weeks
- Different PDF layouts when available

The parser should produce valid structured output.

---

# 10. Payslip Validation

Test that invalid AI output is rejected.

Examples:

```text
Invalid date
Invalid amount
Missing required field
Invalid number type
Unexpected field
Impossible value
```

The application must not save invalid payroll data.

---

# 11. AI Provider Tests

Test both configured providers:

```text
Groq
Cerebras
```

The same input should produce the same required schema.

Provider-specific differences must not affect the rest of the application.

---

# 12. AI Failure Tests

Test:

```text
Provider unavailable
Timeout
Invalid response
Malformed JSON
Empty response
Rate limit
```

Expected behavior:

```text
Parsing failed
        ↓
User is informed
        ↓
Retry / alternative provider / manual entry
```

No incorrect payslip should be created.

---

# 13. Calculation vs Payslip Test

For every imported payslip where enough information exists:

```text
PayTrack calculation
        VS
Actual payslip
```

Compare important values:

```text
Hours
Gross
Deductions
Net
Bank payment
```

Differences should be visible.

The system must not silently modify the payslip to match the calculation.

---

# 14. Historical Payroll Tests

Changing current payroll settings must not modify historical records.

Example:

```text
Week 12
€16.35

Week 13
€16.49
```

Changing Week 13's rate must not change Week 12.

---

# 15. Finance Tests

Test:

```text
Income - Expenses = Savings
```

Example:

```text
Income:    €2,600
Expenses:  €1,500
Savings:   €1,100
```

Savings rate:

```text
€1,100 / €2,600 × 100
= 42.31%
```

---

# 16. Forecast Tests

Forecast calculations must be deterministic.

Test:

```text
Current savings
+
Expected monthly savings
=
Projected savings
```

Forecasts must never modify actual financial records.

---

# 17. Expense Tests

Test:

- Creating an expense
- Editing an expense
- Deleting an expense
- Expense categories
- Recurring expenses
- Monthly totals
- Category totals

---

# 18. Work Tracking Tests

Test:

```text
START WORK
FINISH WORK
```

Verify:

- Timestamp creation
- Finish rounding
- Work duration
- Break calculation
- Payroll calculation
- Manual editing

---

# 19. Manual Correction Tests

The user must be able to correct:

- Start time
- Finish time
- Breaks
- Shift
- Payroll data extracted from a payslip
- Expenses

The corrected value must be used in subsequent calculations.

---

# 20. API Integration Tests

Test important API flows:

```text
Create shift
Create work session
Finish work
Calculate payroll
Upload payslip
Parse payslip
Create expense
Get financial summary
```

Test both successful and invalid requests.

---

# 21. Authorization Tests

Test that User A cannot access User B's:

- Payslips
- Work sessions
- Payroll
- Expenses
- Financial data
- Bank data

This is a mandatory security test.

---

# 22. File Upload Tests

Test:

```text
Valid PDF
Invalid file type
Large file
Empty file
Corrupted PDF
```

The application must reject unsafe or unsupported files.

---

# 23. Banking Tests

Banking is not required for MVP.

When implemented, test:

- Connection
- Authentication flow
- Transaction import
- Duplicate prevention
- Disconnect
- Expired connection
- Sync failure
- Salary matching

Bank credentials must never appear in application logs or tests.

---

# 24. End-to-End Tests

At least these complete flows should be tested.

### Flow 1 — Workday

```text
Open app
↓
START WORK
↓
Work
↓
FINISH WORK
↓
Rounded finish time
↓
Daily paid hours
```

### Flow 2 — Weekly Payroll

```text
Enter shifts
↓
Complete work sessions
↓
Calculate weekly payroll
↓
View estimated salary
```

### Flow 3 — Payslip

```text
Upload PDF
↓
AI parsing
↓
Review
↓
Confirm
↓
Payslip saved
↓
Compare actual vs estimate
```

### Flow 4 — Personal Finance

```text
Receive income
↓
Add expenses
↓
View savings
↓
View savings rate
↓
View forecast
```

---

# 25. Regression Testing

Every bug that affects:

- Payroll
- Working hours
- Money
- Payslip parsing
- Financial calculations

should result in a regression test.

A fixed bug must not silently return later.

---

# 26. Test Data

Use realistic test data.

Include examples based on the user's actual work patterns.

Do not use real sensitive information in public repositories or shared test environments.

Real payslips should not be committed to Git.

---

# 27. Deterministic Calculations

Payroll and financial calculations must be deterministic.

Given the same:

```text
Input
+
Configuration
```

the result must always be the same.

AI must not be part of the actual payroll calculation engine.

---

# 28. Precision

Money calculations must avoid floating-point errors.

Use an appropriate decimal/money representation.

Example:

```text
€0.10 + €0.20
```

must not become:

```text
€0.30000000000000004
```

---

# 29. Time Precision

Time calculations should use explicit units internally.

Prefer:

```text
minutes
```

or another deterministic representation instead of relying on floating-point hours.

Example:

```text
43h 55m
```

should be represented consistently.

---

# 30. Acceptance Criteria

A feature is not complete until:

```text
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Relevant E2E flow passes
[ ] Edge cases are tested
[ ] No existing tests regress
```

Critical payroll changes require especially strong test coverage.

---

# 31. MVP Testing Priority

Priority order:

```text
1. Payroll calculations
2. Time and break calculations
3. Payslip parsing
4. Work tracking
5. Financial calculations
6. Authentication and authorization
7. UI flows
8. Banking integration
```

Banking tests can be added when banking integration is implemented.

---

# 32. Core Testing Rules

1. Money calculations must be tested.
2. Time calculations must be tested.
3. Payroll calculations must be deterministic.
4. Every important payroll edge case must have a test.
5. AI output must be validated.
6. AI failures must be tested.
7. Actual payslips must be kept separate from estimates.
8. Historical payroll data must be tested for immutability.
9. User data isolation must be tested.
10. Every important financial bug must become a regression test.