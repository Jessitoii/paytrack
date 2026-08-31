# PayTrack — Payroll Rules

## 1. Purpose

This document defines the payroll rules currently known for the initial PayTrack payroll profile.

The initial profile is based on the user's current employment through **Carrière uitzendbureau** at Albert Heijn in the Netherlands.

Unknown or unverified payroll rules must not be invented.

---

# 2. Base Hourly Wage

Current base hourly wage:

**€16.35 gross/hour**

A future rate change is expected:

**€16.49 gross/hour from payroll week 13**

The application must support different hourly rates for different effective periods.

Historical payroll records must retain the hourly rate that applied to them.

---

# 3. Time Rounding

After logging out from the Zebra device, the recorded payroll time is rounded upward to the next 5-minute mark.

Examples:

```text
23:21 → 23:25
23:22 → 23:25
23:23 → 23:25
23:24 → 23:25
23:25 → 23:25
```

Therefore:

```text
23:21–23:25 → 23:25
```

This rule currently applies to the recorded finishing time.

Whether the same rule applies to starting time is **UNKNOWN** and must not be assumed.

---

# 4. Break Rules

A normal shift provides:

- 15 minutes paid break
- 30 minutes unpaid break
- 15 minutes paid break

However, the second 15-minute paid break is not always taken.

Typical usage:

```text
15 min paid break
        +
30 min unpaid break
```

The second 15-minute paid break is generally taken when work continues for longer or overtime occurs.

Therefore, PayTrack must not automatically assume that both paid breaks are taken.

### Payroll treatment

**Paid break:**

Included in paid working time.

**Unpaid break:**

Excluded from paid working time.

---

# 5. Shift Types

The workplace generally operates three main shift periods.

### Morning

```text
06:00 – 14:30
```

### Afternoon

```text
14:30 – 23:00
```

### Night

```text
23:00 – 06:00
```

Actual start and end times can vary depending on the weekly schedule and workforce arrangement.

The scheduled shift times are therefore not guaranteed payroll times.

Actual recorded working time must be used for actual payroll calculations.

---

# 6. Shift Rotation

The user's work schedule generally follows an alternating pattern:

```text
Week A → Morning
Week B → Afternoon
Week A → Morning
Week B → Afternoon
```

Morning weeks generally contain around 6 working days.

Afternoon weeks generally contain around 5 working days.

The exact number of working days and days off can change.

This pattern should therefore be treated as a scheduling aid rather than a guaranteed payroll rule.

---

# 7. Premium Rules

## 7.1 Evening Premium

Work performed between:

**22:00 – 00:00**

receives:

**+50%**

This means the applicable hourly rate becomes:

```text
Base rate × 1.50
```

---

## 7.2 Sunday Premium

Work performed on Sunday receives:

**+50%**

Applicable rate:

```text
Base rate × 1.50
```

---

## 7.3 Sunday Evening Premium

Work performed on Sunday between:

**22:00 – 00:00**

receives:

**+75%**

Applicable rate:

```text
Base rate × 1.75
```

---

## 7.4 Night Shift Premium

Night work receives:

**+100%**

Applicable rate:

```text
Base rate × 2.00
```

The exact contractual definition of "night work" and the exact time boundaries requiring the +100% premium are not fully verified in the current information.

The application must therefore keep the night-premium time range configurable.

---

# 8. Premium Combination Rules

Premiums may overlap depending on the applicable payroll agreement.

Known special case:

```text
Sunday + 22:00–00:00
→ +75%
```

The application must not automatically add all premiums together unless the payroll rule explicitly defines that behavior.

For example, it must not assume:

```text
Sunday + Evening + Night
= +50% +50% +100%
```

without a confirmed rule.

---

# 9. Holiday Allowance

The payslips show:

**Vakantiegeld: 8.00%**

This represents accrued holiday allowance.

The calculation base and payment timing must follow the actual payroll rules used by the employer/payroll provider.

Historical payslip values should be treated as authoritative actual results.

---

# 10. Holiday Entitlement

The payslips show:

**Vakantiedagen: 10.49777%**

This represents accrued paid holiday entitlement.

The application should track this as a separate payroll component.

It must not be treated as ordinary hourly salary.

---

# 11. ADV Compensation

The payslips show:

**Belaste ADV-toeslag: 9.005%**

The payslip data also indicates approximately:

**€1.35 per hour**

as the ADV-related addition at the current hourly rate.

The exact calculation base must be confirmed against future payslips/contracts before being treated as a universal formula.

---

# 12. ET Exchange

The payslips contain:

**ET-uitruil**

related to accommodation.

The observed mechanism includes:

1. An amount deducted from taxable salary.
2. A corresponding tax-free amount added back to net salary.

Example from the provided payslips:

```text
Week 33:
ET-uitruil accommodation: -€8.25
Tax-free return: +€8.25

Week 34:
ET-uitruil accommodation: -€11.52
Tax-free return: +€11.52
```

The exact legal calculation and maximum applicable amount are not fully defined in this document.

The implementation must therefore treat ET exchange as a configurable payroll component.

---

# 13. Known Payroll Deductions

The provided payslips contain the following deductions.

### PAWW

Rate:

**0.1000%**

Example:

```text
€556.54 × 0.10% = €0.56
```

---

### AZV

Rate:

**0.7000%**

Example:

```text
€472.19 × 0.70% = €3.31
```

---

### StiPP Pension

Rate:

**7.5000%**

The deduction is calculated from a pension contribution base rather than necessarily from total gross salary.

Example:

```text
Week 33:
€264.78 × 7.5% = €19.86
```

---

### WGA / Whk

Rate:

**0.4050%**

Example:

```text
Week 34:
€742.82 × 0.405% = €3.01
```

---

# 14. Income Tax

The payslips contain:

**Loonheffing**

and a separate:

**Loonheffing bijzonder tarief**

component.

The user has **loonheffingskorting enabled**.

The exact Dutch tax calculation must not be recreated from the limited payslip information in this document.

For the MVP, estimated tax calculations must use a clearly defined calculation method and must be validated against actual payslips.

Tax rules should be configurable and isolated from the rest of the payroll engine.

---

# 15. Health Insurance

The user's payslips show a weekly deduction of:

**€38.01**

for:

**Zorg en Zekerheid (Z&Z)**

There is also an additional insurance deduction:

**€2.76 per week**

The €38.01 amount appears consistently in the provided payslips.

For the initial payroll profile, these can be configured as weekly fixed deductions.

---

# 16. Weekly Payroll

Salary is paid weekly.

The general process is:

```text
Work during week
        ↓
Payroll processed
        ↓
Payslip available
        ↓
Wednesday → payroll information becomes available
        ↓
Thursday → payment received
```

The exact processing/payment schedule may vary and should therefore remain configurable.

---

# 17. Reference Payslip — Week 33

Period:

**10.08.2026 – 16.08.2026**

Working time:

**31h 30m**

Gross salary:

**€556.54**

Net after payroll deductions:

**€485.75**

Additional net adjustments:

```text
ET exchange: +€8.25
Additional insurance: -€2.76
Health insurance: -€38.01
```

Bank payment:

**€453.23**

This payslip is a reference test case.

---

# 18. Reference Payslip — Week 34

Period:

**17.08.2026 – 23.08.2026**

Working time:

**43h 55m**

Gross salary:

**€775.90**

Net after payroll deductions:

**€619.15**

Additional net adjustments:

```text
ET exchange: +€11.52
Additional insurance: -€2.76
Health insurance: -€38.01
```

Bank payment:

**€589.90**

This payslip is a reference test case.

---

# 19. Important Unknowns

The following rules are currently not sufficiently verified:

- Exact definition of the +100% night premium period
- Whether premiums stack or replace each other
- Exact overtime calculation
- Exact tax calculation
- Exact threshold or behavior related to working more than 43 hours
- Exact calculation base for ADV
- Exact calculation base for holiday allowance
- Exact calculation base for holiday entitlement
- Exact ET exchange rules and limits
- Whether start times receive the same 5-minute rounding as logout times
- Whether unpaid breaks are automatically deducted by the employer or must be entered manually
- Exact relationship between Carrière and other workforce providers regarding shift timing

These must be verified before being implemented as confirmed payroll rules.

---

# 20. Implementation Principle

Payroll rules must be configurable.

The calculation engine must never silently invent missing rules.

If a payroll rule is unknown:

```text
UNKNOWN
```

must be represented explicitly until the rule is verified.

Actual payslips are the primary reference for validating estimated payroll results.