# PayTrack — Shift and Time Rules

## 1. Shift Types

The workplace generally has three shift types:

### Morning Shift

```text
06:00 – 14:30
```

### Afternoon Shift

```text
14:30 – 23:00
```

### Night Shift

```text
23:00 – 06:00
```

Actual working times may differ from planned shift times.

---

## 2. Shift Rotation

The usual pattern is:

```text
Week 1 → Morning
Week 2 → Afternoon
Week 3 → Morning
Week 4 → Afternoon
```

This is a general pattern, not a guaranteed schedule.

The actual schedule must always be editable.

---

## 3. Different Workforce Start Times

Workers from different agencies may start 15 minutes apart.

The user's group may sometimes:

```text
Start 15 minutes later
```

while another group starts earlier.

This can change depending on the work assignment.

Therefore, PayTrack must use the **actual planned shift entered by the user** rather than assuming a fixed start time.

---

## 4. Morning Week

During morning-shift weeks, the user generally works around **6 days**.

Sunday is often worked as an afternoon/evening shift instead of the normal morning shift.

Example pattern:

```text
Mon → Morning
Tue → Morning
Wed → Morning
Thu → Morning
Fri → Morning
Sat → Morning
Sun → Afternoon
```

This is only a typical pattern.

Actual days may change.

---

## 5. Afternoon Week

During afternoon-shift weeks, the user generally works around **5 days**.

A Saturday afternoon shift cannot normally be followed by a Sunday morning shift.

Therefore, Sunday scheduling may affect the number of working days.

Example:

```text
Mon → Afternoon
Tue → Afternoon
Wed → Afternoon
Thu → Afternoon
Fri → Afternoon
Sat → Afternoon
Sun → Off
```

This is only an example and must not be treated as a fixed schedule.

---

# 6. Shift Record

Each work shift should contain:

```text
Date
Planned start
Planned end
Actual start
Actual end
Shift type
Breaks
Notes
```

Actual times may differ from planned times.

---

# 7. Start Work

The user can press:

**START WORK**

PayTrack records the current timestamp.

The user must be able to edit this timestamp later.

The application should immediately show:

```text
Working
Started at: HH:MM
```

---

# 8. Finish Work

The user can press:

**FINISH WORK**

PayTrack records the current timestamp.

The finish timestamp must then be rounded upward to the next 5-minute boundary.

Examples:

```text
23:21 → 23:25
23:22 → 23:25
23:23 → 23:25
23:24 → 23:25
23:25 → 23:25
```

The rounded timestamp is used for payroll calculations.

The original timestamp should also be preserved for transparency.

---

# 9. Start-Time Rounding

Start-time rounding is currently:

**UNKNOWN**

Do not automatically apply the 5-minute rounding rule to start times.

Until verified, use the recorded start time as entered.

---

# 10. Break Rules

The user normally has:

```text
15 min paid
30 min unpaid
15 min paid
```

However, the second 15-minute paid break is not always taken.

Typical situation:

```text
Normal day:
15 min paid
30 min unpaid

Long day / overtime:
15 min paid
30 min unpaid
15 min paid
```

---

# 11. Paid Break

A paid break:

```text
15 minutes
```

does not reduce paid working time.

It is included in the paid duration of the shift.

---

# 12. Unpaid Break

The standard unpaid break is:

```text
30 minutes
```

It must be excluded from paid working time.

Example:

```text
Shift duration: 8h 30m
Unpaid break:   30m

Paid time:      8h
```

---

# 13. Second Paid Break

The second 15-minute paid break:

- May not be taken.
- Is usually taken when work continues longer.
- Is usually taken when overtime occurs.

PayTrack must allow the user to explicitly record whether it was taken.

It must not automatically add the second paid break.

---

# 14. Work Session Calculation

Basic calculation:

```text
Elapsed Time =
Rounded Finish Time - Start Time
```

Then:

```text
Paid Time =
Elapsed Time - Unpaid Break Time
```

Paid breaks are not subtracted.

---

# 15. Overtime

The user may work longer than the planned shift.

PayTrack must allow:

```text
Actual End > Planned End
```

without automatically cutting the working session to the planned end time.

Example:

```text
Planned:
14:30 – 23:00

Actual:
14:30 – 23:25
```

The additional time must remain part of the actual work record.

The exact payroll treatment of overtime is currently **UNKNOWN**.

---

# 16. Crossing Midnight

The application must support shifts crossing midnight.

Example:

```text
23:00 → 06:00
```

The finish date is the following calendar day.

The application must not interpret this as a negative duration.

---

# 17. Premium Time Boundaries

The time calculation system must be able to split a shift when it crosses a premium boundary.

Example:

```text
21:00 → 23:30
```

may contain:

```text
21:00 → 22:00  Normal
22:00 → 23:30  Premium
```

The exact premium rules are defined in:

`03-PAYROLL-RULES.md`

---

# 18. Sunday Boundary

Sunday must be determined using the local calendar date of the work period.

A shift crossing midnight must therefore be split when necessary.

Example:

```text
Saturday 23:00 → Sunday 06:00
```

contains both:

```text
Saturday time
Sunday time
```

The applicable payroll rules must be calculated separately for each period.

---

# 19. Manual Corrections

The user must be able to manually edit:

- Start time
- Finish time
- Breaks
- Shift type
- Planned times
- Notes

Manual corrections must override automatically recorded values.

---

# 20. Work Status

A work session can have one of the following states:

```text
Planned
Working
Completed
Edited
Cancelled
```

The application should clearly show the current state.

---

# 21. Multiple Sessions

The system should support multiple work sessions on the same day.

Example:

```text
06:00 → 10:00
11:00 → 14:30
```

Each session should be stored separately.

The daily total is the sum of all applicable paid sessions.

---

# 22. Time Zones

All work times must use the user's local timezone.

For the initial Netherlands configuration:

```text
Europe/Amsterdam
```

Daylight saving time must be handled correctly.

---

# 23. Core Rules

1. Planned time is not actual time.
2. Actual time is used for actual working calculations.
3. Finish time is rounded upward to 5 minutes.
4. Start-time rounding is currently unknown.
5. Unpaid breaks reduce paid time.
6. Paid breaks do not reduce paid time.
7. The second paid break is optional.
8. Overtime must not be automatically discarded.
9. Midnight-crossing shifts must be supported.
10. All manually corrected values override automatic values.
11. Unknown payroll rules must remain configurable.
12. The user must always be able to see and edit recorded work data.