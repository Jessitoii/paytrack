# PayTrack — Architecture

## 1. Goal

PayTrack should have a simple, modular architecture.

The system must be easy to:

- Develop
- Test
- Change
- Deploy
- Extend

Do not introduce unnecessary complexity.

---

# 2. High-Level Architecture

```text
Frontend
   ↓
Backend API
   ↓
Application Services
   ↓
Domain Logic
   ↓
Database
```

External services:

```text
Backend
 ├── AI Provider
 ├── File Storage
 └── Banking Provider (future)
```

---

# 3. Frontend

The frontend is responsible for:

- User interface
- Navigation
- Forms
- Dashboard
- Shift management
- Work tracking
- Expense management
- Payslip upload
- Payslip review
- Charts
- API communication

The frontend must not contain the authoritative payroll calculation logic.

---

# 4. Backend

The backend is responsible for:

- Authentication
- User data
- Work records
- Shift records
- Payroll calculations
- Payslip processing
- Expense data
- Financial forecasts
- File handling
- AI communication
- Future banking integration

The backend is the main source of truth.

---

# 5. Domain Modules

The backend should be separated into logical modules.

```text
auth
users
employment
shifts
work
payroll
payslips
finance
expenses
forecasting
ai
banking
files
```

Modules should have clear responsibilities.

---

# 6. Payroll Module

The payroll module is one of the most important parts of PayTrack.

It should contain:

```text
Time calculation
Break calculation
Premium calculation
Gross calculation
Deduction calculation
Net estimation
```

The payroll engine must be deterministic.

---

# 7. Payroll Configuration

Payroll rules must not be scattered throughout the application.

They should be represented through a centralized configuration.

Example:

```text
Hourly rate
Premium rules
Break rules
Rounding rules
Deduction rates
Allowance rates
Tax configuration
```

Rules must support effective dates.

---

# 8. Calculation Engine

The calculation engine should receive structured input.

Example:

```text
Work sessions
+
Breaks
+
Payroll configuration
+
Pay rate
        ↓
Calculation Engine
        ↓
Payroll Result
```

The engine should return a detailed breakdown.

---

# 9. AI Layer

AI must be isolated behind an abstraction.

```text
Payslip Parser
      ↓
AI Interface
      ↓
Provider
 ├── Groq
 └── Cerebras
```

The payroll system must not depend directly on Groq or Cerebras.

A provider can be replaced without changing payroll logic.

---

# 10. AI Responsibility

AI is responsible for:

```text
Unstructured document
        ↓
Structured data
```

AI is not responsible for:

- Payroll arithmetic
- Tax calculations
- Premium calculations
- Savings calculations
- Financial forecasting calculations

Those are handled by application code.

---

# 11. Payslip Processing

The flow should be:

```text
Upload PDF
    ↓
Store file
    ↓
Extract text
    ↓
AI parser
    ↓
Validate structured data
    ↓
User review
    ↓
Save payslip
    ↓
Compare with PayTrack calculation
```

If AI parsing fails, the user can manually enter the data.

---

# 12. Finance Module

The finance module handles:

- Income
- Expenses
- Savings
- Savings goals
- Financial forecasts

It consumes payroll results but should not contain payroll-specific logic.

Example:

```text
Payroll
   ↓
Actual Income
   ↓
Finance
   ↓
Savings
```

---

# 13. Forecasting

Forecasting should be a separate module.

It receives:

```text
Historical income
Historical expenses
Planned shifts
Current payroll configuration
Recurring expenses
```

and produces:

```text
Projected income
Projected expenses
Projected savings
```

Forecasts are estimates.

---

# 14. File Storage

Uploaded payslips should be stored separately from normal database records.

The database stores metadata:

```text
Payslip
   ↓
File ID
```

The actual PDF is stored in file storage.

The exact storage solution can be selected during implementation.

---

# 15. Database

The database stores structured application data.

Main entities include:

```text
User
Employment
PayRate
Shift
WorkSession
Break
PayrollWeek
PayrollCalculation
PayrollComponent
Payslip
PayslipComponent
Expense
Income
SavingsGoal
FinancialForecast
```

Future:

```text
BankAccount
BankTransaction
```

---

# 16. API

The frontend communicates with the backend through an API.

Example endpoints:

```text
/auth
/users
/shifts
/work
/payroll
/payslips
/expenses
/income
/savings
/forecasts
```

The exact API design can be decided during implementation.

---

# 17. Authentication

All user-specific data must require authentication.

A user must only be able to access their own:

- Work records
- Payslips
- Payroll data
- Expenses
- Financial data
- Bank data

---

# 18. Error Handling

Errors should be handled at module boundaries.

Examples:

```text
Invalid work session
Invalid payroll data
AI parsing failure
PDF extraction failure
Database failure
Bank synchronization failure
```

Errors should not silently produce incorrect financial data.

---

# 19. Validation

Validation should happen before important data enters the calculation engine.

Example:

```text
User Input
    ↓
Validation
    ↓
Payroll Engine
```

and:

```text
AI Output
    ↓
Schema Validation
    ↓
Payroll / Payslip System
```

---

# 20. Frontend Calculation Rule

The frontend may perform simple display calculations.

However, authoritative calculations such as:

- Payroll
- Net salary
- Savings
- Forecasts

should be calculated by the backend/application logic.

This prevents different screens from producing different results.

---

# 21. Historical Data Protection

Changing current payroll configuration must not modify historical payroll results.

Example:

```text
Old:
€16.35

New:
€16.49
```

The new rate applies only to its configured effective period.

---

# 22. External Services

External services should be isolated behind interfaces.

Initial/future integrations:

```text
AI
 ├── Groq
 └── Cerebras

Banking
 └── Open Banking provider
```

The rest of PayTrack should not depend directly on provider-specific implementation details.

---

# 23. MVP Architecture

The MVP should avoid:

- Microservices
- Event-driven architecture
- Kubernetes
- Complex message queues
- Unnecessary caching layers
- Multiple databases

A modular monolith is preferred.

```text
        PayTrack
           │
    ┌──────┴──────┐
 Frontend       Backend
                  │
        ┌─────────┴─────────┐
        │                   │
   Application          Database
      Logic
        │
   ┌────┼────┐
   AI   Files Payroll
```

---

# 24. Architecture Principles

1. Keep the system simple.
2. Prefer a modular monolith.
3. Separate frontend and backend responsibilities.
4. Keep payroll calculations deterministic.
5. Keep AI isolated.
6. Keep external providers replaceable.
7. Keep actual and estimated data separate.
8. Keep historical payroll data immutable.
9. Validate data before calculation.
10. Do not introduce infrastructure that the MVP does not need.