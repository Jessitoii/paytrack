# PayTrack — Project Overview

## 1. Project Name

**PayTrack**

PayTrack is a personal work, payroll, and finance tracking application designed primarily for hourly workers whose working hours and weekly income can vary.

The application combines work-hour tracking, shift planning, payroll estimation, payslip analysis, expense tracking, savings tracking, and financial forecasting into a single platform.

---

## 2. Vision

PayTrack aims to answer the following questions for the user:

- How many hours did I work?
- How much should I earn this week?
- How much will I approximately receive after taxes and deductions?
- How much did I actually receive?
- Why was my actual salary different from my estimate?
- How much did I earn this month?
- How much did I spend?
- How much did I save?
- How much can I expect to save in the coming months?
- When will I reach my financial goals?

The long-term goal is to provide the user with a continuously updated overview of the relationship between **work, income, expenses, and savings**.

---

## 3. Primary Use Case

The initial target use case is an hourly worker in the Netherlands working through an employment agency and receiving a weekly salary.

The initial payroll model is based on the user's current employment conditions at **Albert Heijn through Carrière uitzendbureau**.

However, PayTrack must **not be architecturally tied to Albert Heijn or Carrière**.

The payroll rules should be implemented as configurable rules so that the application can later support:

- Other employers
- Other employment agencies
- Different hourly rates
- Different shift systems
- Different overtime rules
- Different premium rates
- Different deductions
- Different payroll structures

---

## 4. Core Product Areas

PayTrack consists of the following major product areas.

### 4.1 Work Tracking

The user can record when they start and finish work.

The primary interaction should be extremely fast.

The user should be able to press a single button to indicate:

> "I started working."

and later:

> "I finished working."

The application records the relevant timestamp automatically.

The user can also manually enter or edit working times.

---

### 4.2 Shift Planning

The user can enter their upcoming weekly shifts.

A shift may contain:

- Date
- Planned start time
- Planned end time
- Shift type
- Expected break profile
- Notes

PayTrack should support recurring shift patterns while allowing individual days to be modified.

Planned schedules are estimates and must always be editable.

---

### 4.3 Actual Working Time

PayTrack compares planned working times with actual working times.

The application should show:

- Planned duration
- Actual duration
- Paid duration
- Unpaid break duration
- Difference between planned and actual time
- Estimated earnings

The system must distinguish between:

**elapsed time** and **paid working time**.

---

### 4.4 Payroll Calculation

PayTrack contains a deterministic payroll calculation engine.

The calculation engine is responsible for estimating:

- Gross earnings
- Premium earnings
- Holiday allowance
- Holiday entitlement
- ADV compensation
- Payroll deductions
- Estimated net salary
- Weekly salary
- Monthly salary

The payroll calculation engine must not depend on an AI model.

AI may extract information from payslips, but all financial calculations must be performed by deterministic application logic.

---

### 4.5 Payslip Import and AI Parsing

The user can upload a payslip PDF.

The application processes the payslip and converts relevant information into structured data.

The intended pipeline is:

```text
Payslip PDF
    ↓
Text / document extraction
    ↓
AI parsing
    ↓
Structured JSON
    ↓
Schema validation
    ↓
Business-rule validation
    ↓
Payslip record
```

The initial AI providers under consideration are:

- Groq
- Cerebras

The AI provider must be abstracted behind a provider interface so that the implementation can be changed without modifying the rest of the application.

AI is used primarily for **document understanding and data extraction**, not for financial calculations.

---

### 4.6 Income Tracking

PayTrack stores historical payroll information and provides:

- Weekly income
- Monthly income
- Average weekly income
- Average monthly income
- Income by period
- Gross vs net income
- Estimated vs actual income

The application should be able to use historical data to generate future income estimates.

---

### 4.7 Expense Tracking

Users can manually record expenses.

Expenses should support:

- Amount
- Date
- Category
- Description
- Optional merchant
- Optional notes

The system should support configurable expense categories.

Examples include:

- Food
- Transportation
- Housing
- Phone
- Fitness
- Shopping
- Entertainment
- Bills
- Other

---

### 4.8 Banking Integration

A future version of PayTrack may connect to the user's bank account through an appropriate Open Banking / PSD2 solution.

The initial intended bank integration is ING Netherlands.

The application should never require the user to provide their banking password directly to PayTrack.

Bank authentication and consent should be handled through the appropriate bank/Open Banking authorization flow.

Once available, banking integration may provide:

- Account balance
- Transactions
- Transaction dates
- Transaction amounts
- Merchant information
- Automatic transaction synchronization

Banking integration is not required for the first MVP.

---

### 4.9 Savings Tracking

PayTrack calculates the user's savings based on income and expenses.

The application should provide:

- Current savings
- Monthly savings
- Savings rate
- Historical savings
- Average monthly savings
- Projected savings

The basic concept is:

```text
Savings = Income - Expenses
```

The exact implementation must account for the distinction between actual bank transactions and estimated future income/expenses.

---

### 4.10 Financial Forecasting

PayTrack should estimate future financial outcomes based on historical and planned data.

Examples:

- Expected income this month
- Expected expenses this month
- Expected monthly savings
- Expected savings after 3 months
- Expected savings after 6 months
- Expected savings after 12 months
- Estimated time to reach a savings goal

Forecasts must clearly be presented as **estimates**, not guaranteed outcomes.

---

### 4.11 Savings Goals

Users can create financial goals.

A goal may contain:

- Goal name
- Target amount
- Current amount
- Target date (optional)
- Notes

Examples:

- Emergency fund
- Car
- Phone
- Travel
- Investment
- House deposit

PayTrack should calculate the approximate time required to reach a goal based on the user's current savings rate.

---

## 5. Key User Workflow

The primary workflow is:

```text
Plan shifts
    ↓
Start work
    ↓
Finish work
    ↓
Calculate actual paid hours
    ↓
Estimate weekly income
    ↓
Receive payslip
    ↓
Upload payslip PDF
    ↓
Extract actual payroll data
    ↓
Compare estimate vs actual
    ↓
Record actual income
    ↓
Track expenses
    ↓
Calculate savings
    ↓
Forecast future savings
```

This workflow should require as little manual data entry as possible.

---

## 6. Design Principles

### 6.1 Accuracy Over Convenience

Financial calculations must be deterministic and reproducible.

The same input must always produce the same calculation result.

---

### 6.2 AI Extracts, Code Calculates

AI should be used for tasks such as:

- Reading payslips
- Extracting structured information
- Understanding payroll terminology
- Categorizing transactions

AI should not be responsible for:

- Calculating salary
- Calculating taxes
- Calculating deductions
- Calculating working hours
- Performing financial arithmetic

---

### 6.3 Manual Override

Automatically generated information must be editable.

Examples:

- AI-extracted payslip values
- Automatically generated shift schedules
- Automatically categorized expenses
- Imported bank transactions

The user must always be able to correct incorrect data.

---

### 6.4 Transparent Calculations

The application should be able to explain how a value was calculated.

For example:

```text
Paid hours: 42h 30m
Hourly rate: €16.35
Night premium: €XX
Sunday premium: €XX
Gross estimate: €XXX
Estimated deductions: €XXX
Estimated net: €XXX
```

Users should not see a mysterious final number without being able to inspect its components.

---

### 6.5 Historical Accuracy

Historical payslips represent actual payroll results and should not be recalculated using today's payroll rules unless explicitly requested.

For example, if the hourly rate changes in the future, old payslips must retain the original rate applicable at that time.

---

### 6.6 Configurable Rules

Payroll and work rules must be configurable.

Business rules should not be hard-coded throughout the application.

This is especially important because:

- Hourly rates can change
- Premium rates can change
- Employment conditions can change
- Tax rules can change
- Employer rules can change
- Break rules can change

---

### 6.7 Privacy and Security

PayTrack handles sensitive financial information, including:

- Payslips
- Income
- Expenses
- Bank transactions
- Account balances

Security and privacy must therefore be considered a core product requirement rather than an optional future feature.

Bank credentials must never be stored by PayTrack.

---

## 7. Initial Scope

The initial development scope should include:

### MVP

- User profile
- Weekly shift planning
- Start-work button
- Finish-work button
- Manual time entry
- Break management
- Actual working-time calculation
- Payroll calculation engine
- Weekly salary estimation
- Monthly salary estimation
- Payslip PDF upload
- AI payslip parsing
- Payslip validation
- Historical payslip storage
- Expense tracking
- Monthly income/expense overview
- Savings calculation
- Basic financial forecasting
- Basic dashboard

### Post-MVP

- ING/Open Banking integration
- Automatic bank transaction synchronization
- Automatic transaction categorization
- Advanced financial forecasting
- Savings goals
- Advanced analytics
- Multiple employers
- Multiple payroll profiles
- Automated schedule import
- Schedule screenshot/PDF parsing
- Notifications and reminders

---

## 8. Initial Payroll Context

The first implementation will support the user's current payroll situation in the Netherlands.

Known initial parameters include:

- Base hourly rate: €16.35
- Planned hourly rate increase: €16.49 from week 13
- Paid premium periods
- Night-shift premium
- Sunday premium
- Unpaid break
- Paid breaks
- Weekly payroll
- Pension contribution
- Healthcare-related deductions
- Other payroll deductions
- Holiday allowance
- Holiday entitlement
- ADV compensation
- ET exchange mechanism

The complete and authoritative payroll rules are documented separately in:

`docs/03-PAYROLL-RULES.md`

The mathematical implementation of these rules is documented separately in:

`docs/04-CALCULATION-SPEC.md`

The application must not infer missing payroll rules from this document.

---

## 9. Source of Truth

The `/docs` directory is the primary product and business-rule reference for the project.

When implementing the application:

1. Read the relevant documentation first.
2. Follow documented requirements.
3. Do not invent business rules.
4. Do not silently change documented behavior.
5. Clearly identify assumptions.
6. Keep implementation and documentation synchronized.
7. Update documentation when an approved requirement changes.

If a requirement is genuinely ambiguous, it should be marked as unresolved rather than guessed.

---

## 10. Project Philosophy

PayTrack should remain simple for the user even if its internal calculation system is sophisticated.

The ideal experience is:

> **Work → Tap → Track → Get Paid → Understand → Save**

The user should spend seconds entering daily work information while the application performs the detailed calculations and analysis in the background.

The long-term goal is for PayTrack to become a reliable personal financial assistant for hourly workers, combining accurate payroll tracking with practical financial forecasting.