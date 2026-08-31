# PayTrack — Payslip AI Parser

## 1. Purpose

PayTrack allows the user to upload a payslip PDF and automatically convert it into structured payroll data.

The AI is used for **reading and extracting information**.

The AI must not perform payroll calculations.

---

# 2. Basic Flow

```text
Payslip PDF
    ↓
PDF extraction
    ↓
AI
    ↓
Structured JSON
    ↓
Schema validation
    ↓
User review
    ↓
Save payslip
```

---

# 3. PDF Upload

The user must be able to upload a payslip PDF.

The application should:

- Accept PDF files.
- Store the original file when possible.
- Extract text from the PDF.
- Send the relevant content to the AI parser.

If text extraction fails, the system may use another document-reading method.

---

# 4. AI Provider

The AI layer must use a provider abstraction.

Initial providers:

- Groq
- Cerebras

The application must be able to switch providers without changing the payroll system.

Example:

```text
AI Parser
   │
   ├── Groq Provider
   │
   └── Cerebras Provider
```

---

# 5. AI Responsibilities

The AI may extract:

### Payroll period

- Week number
- Start date
- End date

### Working time

- Normal hours
- Training hours
- Overtime hours
- Other hour types

### Earnings

- Base salary
- Premiums
- ADV
- Holiday allowance
- Holiday entitlement
- Other earnings

### Deductions

- PAWW
- AZV
- StiPP
- WGA / Whk
- Loonheffing
- Other deductions

### Adjustments

- ET exchange
- Tax-free adjustments
- Insurance deductions

### Final values

- Total gross
- Net after payroll deductions
- Final bank payment

---

# 6. Structured Output

The AI must return structured data.

Example:

```json
{
  "payroll_period": {
    "week": 34,
    "start_date": "2026-08-17",
    "end_date": "2026-08-23"
  },
  "hours": {
    "normal_hours": 43.9167,
    "training_hours": 0
  },
  "earnings": {
    "base": 658.31,
    "adv": 59.29,
    "holiday_days": 11.52,
    "holiday_allowance": 58.30
  },
  "deductions": {
    "paww": 0.78,
    "azv": 4.61,
    "stipp": 27.69,
    "wga": 3.01,
    "loonheffing": 120.66
  },
  "adjustments": {
    "et_exchange": 11.52,
    "health_insurance": 38.01,
    "additional_insurance": 2.76
  },
  "totals": {
    "gross": 775.90,
    "net": 619.15,
    "bank_payment": 589.90
  }
}
```

This is an example schema, not the final schema.

The final schema must be defined in the implementation.

---

# 7. No Guessing

The AI must not invent missing information.

If a value cannot be confidently extracted:

```text
null
```

should be returned instead of a guessed value.

The parser should also provide confidence information where useful.

---

# 8. Validation

AI output must be validated before being saved.

Validation should check:

- Correct data types
- Required fields
- Valid dates
- Valid monetary values
- Valid hour values
- No impossible negative values unless explicitly allowed
- Internal consistency where possible

Invalid output must not silently enter the payroll system.

---

# 9. User Review

After parsing, the user must see the extracted data before it becomes an official payslip record.

Example:

```text
Week 34

Normal hours       43h 55m
Base salary        €658.31
ADV                €59.29
Holiday allowance  €58.30
Gross              €775.90

StiPP              -€27.69
Loonheffing        -€120.66
Health insurance   -€38.01

Bank payment       €589.90

[Confirm] [Edit]
```

The user must be able to edit any extracted value.

---

# 10. Original PDF

The original payslip should be retained when possible.

This allows the user to:

- Recheck information
- Re-run parsing
- Compare extracted data with the original document

---

# 11. Duplicate Detection

The application should detect likely duplicate payslips.

A duplicate may be identified using:

- Payroll week
- Payroll period
- Employer
- Net payment
- File hash

The user should be warned before creating a duplicate record.

---

# 12. AI and Calculation Separation

The AI parser produces data.

The calculation engine performs calculations.

```text
AI Parser
    ↓
Extracted Data
    ↓
Validation
    ↓
Calculation Engine
    ↓
Payroll Result
```

Never:

```text
PDF → AI → "Your salary is €589.90"
```

The AI may extract that the payslip says €589.90, but the application must treat it as **actual payroll data**, not as an AI calculation.

---

# 13. Payslip vs Estimate

The parser should distinguish between:

**Actual values from payslip**

and

**Calculated estimates from PayTrack**

Example:

```text
PayTrack estimate: €591.20
Payslip actual:    €589.90
Difference:        -€1.30
```

The payslip value is authoritative for the actual payroll record.

---

# 14. Error Handling

If parsing fails:

The application should show:

> "We couldn't reliably read this payslip."

The user should be able to:

- Retry
- Change AI provider
- Manually enter the data

The application must not create a potentially incorrect payroll record from failed parsing.

---

# 15. Privacy

Payslips contain sensitive financial information.

The application must:

- Protect uploaded payslips.
- Avoid unnecessary storage of AI requests/responses.
- Never expose payslip data publicly.
- Inform the user when data is sent to an external AI provider.

API keys must never be stored in the frontend.

---

# 16. Provider Failure

If Groq fails:

```text
Groq
 ↓
Failure
 ↓
Cerebras
```

The application may retry using another configured provider.

Provider failures must not cause loss of the uploaded payslip.

---

# 17. Future AI Features

The same AI architecture may later support:

- Schedule PDF parsing
- Schedule screenshot parsing
- Automatic expense categorization
- Bank transaction categorization
- Payslip anomaly detection

These are outside the initial implementation.

---

# 18. Core Rules

1. AI extracts; code calculates.
2. AI must return structured data.
3. AI must not guess missing values.
4. AI output must be validated.
5. User must review extracted data.
6. User corrections override AI output.
7. Original payslip should be preserved.
8. AI providers must be replaceable.
9. Failed parsing must not create incorrect payroll records.
10. Payslip data must be treated as sensitive financial data.