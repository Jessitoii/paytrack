# PayTrack — Requirements

## 1. Requirement Priority

Requirements are divided into four priority levels:

- **MUST** — Required for the MVP.
- **SHOULD** — Important, but not required for the first usable version.
- **COULD** — Nice to have.
- **WON'T** — Not planned for the current version.

---

# 2. Work Tracking

| ID | Requirement | Priority |
|---|---|---|
| WORK-001 | User must be able to start a work session with one button. | MUST |
| WORK-002 | User must be able to finish a work session with one button. | MUST |
| WORK-003 | Start and finish timestamps must be recorded automatically. | MUST |
| WORK-004 | User must be able to manually enter working times. | MUST |
| WORK-005 | User must be able to edit existing working times. | MUST |
| WORK-006 | User must be able to delete a work record. | MUST |
| WORK-007 | The application must calculate elapsed working time. | MUST |
| WORK-008 | The application must calculate paid working time. | MUST |
| WORK-009 | The application must apply the configured Zebra logout rounding rule. | MUST |
| WORK-010 | User should be able to configure a clock offset if their phone clock differs from the workplace clock. | SHOULD |

---

# 3. Shift Planning

| ID | Requirement | Priority |
|---|---|---|
| SHIFT-001 | User must be able to create weekly shifts. | MUST |
| SHIFT-002 | User must be able to edit shifts. | MUST |
| SHIFT-003 | User must be able to delete shifts. | MUST |
| SHIFT-004 | A shift must contain date, start time, and end time. | MUST |
| SHIFT-005 | User must be able to mark a day as OFF. | MUST |
| SHIFT-006 | User must be able to define a shift type. | MUST |
| SHIFT-007 | User should be able to define recurring shift patterns. | SHOULD |
| SHIFT-008 | The application should support alternating morning/afternoon weeks. | SHOULD |
| SHIFT-009 | The application should generate suggested schedules from recurring patterns. | SHOULD |
| SHIFT-010 | User must be able to override automatically suggested schedules. | MUST |
| SHIFT-011 | User should be able to see planned weekly working hours. | SHOULD |

---

# 4. Breaks

| ID | Requirement | Priority |
|---|---|---|
| BREAK-001 | The application must support a 15-minute paid break. | MUST |
| BREAK-002 | The application must support a 30-minute unpaid break. | MUST |
| BREAK-003 | The application must support a second 15-minute paid break. | MUST |
| BREAK-004 | The standard break configuration should contain one 15-minute paid break and one 30-minute unpaid break. | MUST |
| BREAK-005 | The second 15-minute paid break must not be automatically deducted unless selected. | MUST |
| BREAK-006 | User must be able to add the second paid break when necessary. | MUST |
| BREAK-007 | User must be able to manually modify breaks for an individual work session. | MUST |
| BREAK-008 | Unpaid breaks must be excluded from paid working time. | MUST |
| BREAK-009 | Paid breaks must remain part of paid working time. | MUST |

---

# 5. Payroll Calculation

| ID | Requirement | Priority |
|---|---|---|
| PAY-001 | The application must calculate earnings from paid working hours. | MUST |
| PAY-002 | The application must support configurable hourly rates. | MUST |
| PAY-003 | The application must support different hourly rates for different periods. | MUST |
| PAY-004 | The application must support shift premiums. | MUST |
| PAY-005 | The application must support Sunday premiums. | MUST |
| PAY-006 | The application must support night premiums. | MUST |
| PAY-007 | The application must support premium combinations such as Sunday + night. | MUST |
| PAY-008 | The application must support ADV compensation. | MUST |
| PAY-009 | The application must support holiday allowance. | MUST |
| PAY-010 | The application must support holiday entitlement. | MUST |
| PAY-011 | The application must support payroll deductions. | MUST |
| PAY-012 | Payroll calculations must be deterministic. | MUST |
| PAY-013 | Payroll calculations must not depend on AI output after data extraction. | MUST |
| PAY-014 | The application must preserve historical payroll rates and rules. | MUST |
| PAY-015 | The application should show the components contributing to an estimated salary. | SHOULD |

---

# 6. Weekly Payroll

| ID | Requirement | Priority |
|---|---|---|
| WEEK-001 | The application must group work records by payroll week. | MUST |
| WEEK-002 | The application must calculate estimated weekly gross income. | MUST |
| WEEK-003 | The application must calculate estimated weekly net income. | MUST |
| WEEK-004 | The application must store actual weekly payroll data from payslips. | MUST |
| WEEK-005 | The application must compare estimated and actual weekly income. | MUST |
| WEEK-006 | The application should identify major differences between estimated and actual income. | SHOULD |

---

# 7. Monthly Income

| ID | Requirement | Priority |
|---|---|---|
| MONTH-001 | The application must calculate monthly income. | MUST |
| MONTH-002 | The application must distinguish actual and estimated income. | MUST |
| MONTH-003 | The application must calculate average monthly income. | MUST |
| MONTH-004 | The application should estimate remaining income for the current month. | SHOULD |
| MONTH-005 | The application should provide future monthly income forecasts. | SHOULD |

---

# 8. Payslip Management

| ID | Requirement | Priority |
|---|---|---|
| SLIP-001 | User must be able to upload a payslip PDF. | MUST |
| SLIP-002 | The application must extract relevant payroll information from the PDF. | MUST |
| SLIP-003 | AI may be used to convert extracted information into structured data. | MUST |
| SLIP-004 | Extracted data must be validated against a defined schema. | MUST |
| SLIP-005 | The user must be able to review extracted information before saving it. | MUST |
| SLIP-006 | The user must be able to correct extracted information. | MUST |
| SLIP-007 | The application must store accepted payslip data. | MUST |
| SLIP-008 | The application should preserve the original uploaded payslip. | SHOULD |
| SLIP-009 | The application should compare payslip values with calculated values. | SHOULD |
| SLIP-010 | AI must not perform payroll calculations. | MUST |

---

# 9. Expenses

| ID | Requirement | Priority |
|---|---|---|
| EXP-001 | User must be able to add an expense manually. | MUST |
| EXP-002 | User must be able to edit an expense. | MUST |
| EXP-003 | User must be able to delete an expense. | MUST |
| EXP-004 | Expenses must contain amount and date. | MUST |
| EXP-005 | Expenses should support categories. | MUST |
| EXP-006 | Expenses should support descriptions. | SHOULD |
| EXP-007 | The application must calculate total monthly expenses. | MUST |
| EXP-008 | The application should show expenses by category. | SHOULD |
| EXP-009 | The application should calculate average monthly expenses. | SHOULD |

---

# 10. Savings

| ID | Requirement | Priority |
|---|---|---|
| SAVE-001 | The application must calculate savings from income and expenses. | MUST |
| SAVE-002 | The application must show monthly savings. | MUST |
| SAVE-003 | The application must calculate savings rate. | MUST |
| SAVE-004 | The application should show historical savings. | SHOULD |
| SAVE-005 | The application should calculate projected savings. | SHOULD |
| SAVE-006 | User should be able to create savings goals. | SHOULD |
| SAVE-007 | The application should estimate when a savings goal will be reached. | SHOULD |

---

# 11. Financial Forecasting

| ID | Requirement | Priority |
|---|---|---|
| FORECAST-001 | The application must estimate expected income for the current month. | MUST |
| FORECAST-002 | The application should estimate future monthly income. | SHOULD |
| FORECAST-003 | The application should estimate future monthly savings. | SHOULD |
| FORECAST-004 | The application should provide 3-, 6-, and 12-month projections. | SHOULD |
| FORECAST-005 | Forecasts must clearly be identified as estimates. | MUST |
| FORECAST-006 | Forecasts must use historical and/or planned data. | MUST |

---

# 12. Dashboard

| ID | Requirement | Priority |
|---|---|---|
| DASH-001 | The application must provide a main dashboard. | MUST |
| DASH-002 | Dashboard must show current work status. | MUST |
| DASH-003 | Dashboard must show current week's working hours. | MUST |
| DASH-004 | Dashboard must show estimated weekly income. | MUST |
| DASH-005 | Dashboard must show monthly income. | MUST |
| DASH-006 | Dashboard must show monthly expenses. | MUST |
| DASH-007 | Dashboard must show monthly savings. | MUST |
| DASH-008 | Dashboard should show upcoming shifts. | SHOULD |
| DASH-009 | Dashboard should show financial forecasts. | SHOULD |

---

# 13. AI

| ID | Requirement | Priority |
|---|---|---|
| AI-001 | AI must support payslip data extraction. | MUST |
| AI-002 | AI output must use a predefined structured schema. | MUST |
| AI-003 | AI output must be validated before entering the payroll system. | MUST |
| AI-004 | User must be able to correct AI-extracted data. | MUST |
| AI-005 | AI provider must be replaceable. | MUST |
| AI-006 | Initial AI providers may include Groq and Cerebras. | SHOULD |
| AI-007 | AI should not be responsible for financial arithmetic. | MUST |
| AI-008 | Future versions may support schedule extraction from screenshots/PDFs. | COULD |
| AI-009 | Future versions may support transaction categorization. | COULD |

---

# 14. Banking

| ID | Requirement | Priority |
|---|---|---|
| BANK-001 | Banking integration must not require the user to provide banking credentials directly to PayTrack. | MUST |
| BANK-002 | The application should support Open Banking / PSD2 integrations. | SHOULD |
| BANK-003 | ING Netherlands is the initial planned bank integration. | SHOULD |
| BANK-004 | The application should synchronize account transactions. | SHOULD |
| BANK-005 | The application should synchronize account balance. | SHOULD |
| BANK-006 | The application should detect salary payments. | COULD |
| BANK-007 | The application should categorize imported transactions. | COULD |

Banking integration is not required for the initial MVP.

---

# 15. Security and Privacy

| ID | Requirement | Priority |
|---|---|---|
| SEC-001 | Sensitive financial data must be protected. | MUST |
| SEC-002 | Banking credentials must never be stored by PayTrack. | MUST |
| SEC-003 | User must be informed before financial documents are sent to third-party AI services. | MUST |
| SEC-004 | Access to financial data must be authenticated and authorized. | MUST |
| SEC-005 | Uploaded payslips should be treated as sensitive data. | MUST |

---

# 16. Data Integrity

| ID | Requirement | Priority |
|---|---|---|
| DATA-001 | Financial calculations must be reproducible. | MUST |
| DATA-002 | Historical payslips must not change when current payroll settings change. | MUST |
| DATA-003 | User corrections must override automatically extracted values. | MUST |
| DATA-004 | Invalid financial values must not silently enter the calculation engine. | MUST |
| DATA-005 | Important calculations should have automated tests. | MUST |

---

# 17. Future / Won't for MVP

The following are intentionally excluded from the first MVP:

- Automatic ING synchronization
- Investment portfolio tracking
- Cryptocurrency tracking
- Loans and debt management
- Automatic bill payment
- Multi-user household finance
- Advanced financial AI assistant
- Automatic schedule screenshot parsing
- Multiple employers
- Complex tax optimization
- Full accounting functionality

These features may be reconsidered after the MVP.

---

# 18. MVP Definition

The MVP is considered functional when a user can:

1. Plan a work week.
2. Start a work session.
3. Finish a work session.
4. Record and modify breaks.
5. Calculate paid working hours.
6. Estimate weekly salary.
7. Estimate monthly income.
8. Upload a payslip.
9. Review and correct AI-extracted payslip data.
10. Compare estimated salary with actual salary.
11. Record expenses.
12. Calculate monthly savings.
13. View basic financial forecasts.
14. View all important information from the dashboard.

The MVP must produce deterministic payroll calculations and must not rely on AI for financial arithmetic.