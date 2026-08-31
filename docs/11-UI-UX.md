# PayTrack — UI/UX

## 1. Design Goal

PayTrack should feel:

- Modern
- Clean
- Premium
- Fast
- Simple
- Professional

The interface should look like a modern fintech application.

Avoid an old-fashioned admin dashboard look.

---

# 2. Design Philosophy

The most important information should always be visible quickly.

The user should understand:

```text
How much did I earn?
How much did I work?
How much did I spend?
How much did I save?
```

without navigating through many screens.

Avoid unnecessary UI elements.

---

# 3. Visual Style

Use:

- Clean layouts
- Generous spacing
- Rounded cards
- Subtle borders
- Soft shadows
- Clear typography
- Minimal icons
- Smooth animations
- Consistent spacing

The design should feel polished but not overloaded.

---

# 4. Color System

Use a restrained color palette.

Primary:

- Modern green or teal accent
- Neutral background
- Dark text

Use semantic colors for:

```text
Income       → Positive
Expense      → Negative
Savings      → Positive
Warning      → Warning
Error        → Error
Estimate     → Neutral / muted
```

Do not use many bright colors simultaneously.

---

# 5. Typography

Use a modern sans-serif font.

Recommended:

```text
Inter
```

Typography should have a clear hierarchy:

```text
Large → Main financial numbers
Medium → Section titles
Small → Supporting information
```

Money amounts should be visually prominent.

Example:

```text
€589.90
Net Pay
```

---

# 6. Navigation

Desktop navigation should use a clean sidebar.

Main sections:

```text
Dashboard
Work
Payroll
Finance
Payslips
Settings
```

On mobile, use a bottom navigation or compact navigation system.

---

# 7. Dashboard

The dashboard is the most important screen.

It should show:

```text
Good afternoon

This week
€XXX estimated
XXh XXm worked
```

Then:

```text
Income
Expenses
Savings
```

Then:

```text
Next shift
```

Then:

```text
Monthly overview
```

Then:

```text
Savings goal
```

---

# 8. Work Dashboard

The Work screen should make starting and finishing work extremely easy.

Primary action:

```text
┌──────────────────────┐
│                      │
│     START WORK       │
│                      │
└──────────────────────┘
```

When working:

```text
┌──────────────────────┐
│                      │
│     FINISH WORK      │
│                      │
│     05:42:18         │
│                      │
└──────────────────────┘
```

The button should be the most prominent element on the screen.

---

# 9. Quick Finish

The user should be able to finish work with one tap.

After pressing:

```text
FINISH WORK
```

show:

```text
Finished at 23:21
Payroll time: 23:25
```

This makes the 5-minute rounding transparent.

---

# 10. Shift Calendar

Provide a calendar/list view for planned shifts.

Example:

```text
MON 24
06:00 – 14:30
Morning

TUE 25
06:00 – 14:30
Morning

WED 26
06:00 – 14:30
Morning
```

The user should be able to quickly edit a shift.

---

# 11. Shift Creation

Shift creation should be simple.

Fields:

```text
Date
Start
End
Shift type
```

Optional:

```text
Breaks
Notes
```

Use sensible defaults.

---

# 12. Work History

Show completed work sessions in a clean list.

Example:

```text
Mon 24 Aug
06:00 → 14:37
8h 07m paid
€XXX estimated

Tue 25 Aug
06:02 → 14:31
7h 59m paid
€XXX estimated
```

---

# 13. Weekly Payroll Card

Each week should have a summary card.

Example:

```text
Week 34

43h 55m
€658.31 base

Gross
€775.90

Estimated net
€XXX
```

If a payslip exists:

```text
Actual
€589.90
```

---

# 14. Estimate vs Actual

Use a clear visual distinction.

Example:

```text
Estimated
€610.40

Actual
€589.90
```

Actual values should have stronger visual emphasis.

---

# 15. Payslip Upload

The upload screen should be extremely simple.

```text
Upload Payslip

Drop PDF here

or

[Choose PDF]
```

After upload:

```text
Reading payslip...
```

Then:

```text
Payslip found
Week 34
€589.90

[Review]
```

---

# 16. Payslip Review

Show extracted values before saving.

Example:

```text
Week 34

Working hours
43h 55m

Gross
€775.90

Net
€619.15

Bank payment
€589.90
```

Components should be expandable.

Example:

```text
Payroll deductions   >
Allowances            >
Tax                   >
Insurance             >
```

---

# 17. Finance Dashboard

The Finance screen should immediately show:

```text
Monthly income
€2,600

Monthly expenses
€1,500

Monthly savings
€1,100

Savings rate
42.3%
```

---

# 18. Finance Charts

Use simple, readable charts.

Useful charts:

### Income vs Expenses

```text
Income
████████████

Expenses
███████
```

### Savings Over Time

Show savings progression across months.

### Expense Breakdown

Show spending by category.

Charts must not become visually dominant.

---

# 19. Expense Entry

Adding an expense should take only a few seconds.

Example:

```text
Amount
€35.40

Category
Food

Description
Albert Heijn

[Save Expense]
```

The amount field should be immediately focused when appropriate.

---

# 20. Expense List

Example:

```text
Today

Food
Albert Heijn
-€35.40

Transport
OVpay
-€12.80

Yesterday

Subscription
Spotify
-€11.99
```

---

# 21. Savings Goals

Use progress cards.

Example:

```text
Emergency Fund

€1,800 / €5,000

████████░░░░░░░░

36%

Estimated:
~4 months
```

---

# 22. Forecast

Forecasts should be visually separated from actual data.

Example:

```text
September Forecast

Expected income
€2,700

Expected expenses
€1,500

Expected savings
€1,200
```

Use a subtle label:

```text
ESTIMATE
```

---

# 23. Weekly / Monthly Toggle

Where relevant, allow:

```text
Week | Month | Year
```

Use segmented controls instead of dropdowns where practical.

---

# 24. Responsive Design

PayTrack must work well on:

- Desktop
- Laptop
- Tablet
- Mobile

Mobile should not simply be a scaled-down desktop interface.

The work tracking screen should be especially optimized for mobile.

---

# 25. Mobile Work Screen

The user may use the application immediately before or after work.

Therefore:

- Large buttons
- Large readable time
- Minimal navigation
- Minimal typing
- High contrast
- Fast loading

The primary action must be reachable with one hand.

---

# 26. Loading States

Use polished loading states.

Avoid blank screens.

Example:

```text
Loading payroll...
```

or skeleton cards.

---

# 27. Empty States

Empty screens should explain what to do.

Example:

```text
No payslips yet.

Upload your first payslip to start
tracking your real salary.

[Upload Payslip]
```

---

# 28. Error States

Errors should be understandable.

Avoid technical messages such as:

```text
500 Internal Server Error
```

Instead:

```text
Something went wrong.

Your data was not changed.

[Try Again]
```

---

# 29. Confirmations

Use lightweight confirmations.

Example:

```text
✓ Work session saved
```

Avoid unnecessary modal dialogs.

---

# 30. Animations

Use subtle animations for:

- Page transitions
- Cards appearing
- Progress bars
- Button feedback
- Saving states

Animations must be fast and purposeful.

Avoid excessive animations.

---

# 31. Accessibility

The UI should support:

- Keyboard navigation
- Clear focus states
- Readable font sizes
- Sufficient contrast
- Screen-reader-friendly labels
- Accessible buttons and forms

Do not rely on color alone to communicate meaning.

---

# 32. Dark Mode

Dark mode should be supported if practical.

The design system must be created so that dark mode can be added without redesigning the entire application.

---

# 33. Consistency

Use a consistent design system for:

- Buttons
- Cards
- Inputs
- Typography
- Icons
- Spacing
- Status indicators
- Charts
- Modals

Do not create a different visual style for every page.

---

# 34. Important UX Principle

The application should optimize for **frequent actions**.

The user should be able to:

```text
Start work
Finish work
Add expense
Add shift
Upload payslip
```

with minimal interaction.

---

# 35. Premium Feel

PayTrack should feel like a product, not a prototype.

Prioritize:

- Strong visual hierarchy
- Consistent spacing
- Smooth interactions
- Clean typography
- High-quality icons
- Excellent mobile experience
- Clear financial presentation

Avoid:

- Excessive gradients
- Excessive glassmorphism
- Huge decorative elements
- Too many colors
- Dense tables everywhere
- Unnecessary animations
- Generic admin-dashboard templates

---

# 36. Core UX Rules

1. Keep the interface simple.
2. Make money and work information immediately understandable.
3. Make Start Work and Finish Work extremely fast.
4. Use actual values more prominently than estimates.
5. Never hide important financial information behind unnecessary navigation.
6. Use consistent components.
7. Optimize the most frequent actions.
8. Make mobile usage first-class.
9. Keep charts simple.
10. Make PayTrack feel modern, polished, and trustworthy.