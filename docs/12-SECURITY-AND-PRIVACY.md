# PayTrack — Security and Privacy

## 1. Goal

PayTrack handles sensitive financial information.

Security and privacy must be treated as core requirements.

---

# 2. Sensitive Data

PayTrack may contain:

- Payslips
- Salary information
- Working hours
- Expenses
- Savings
- Bank transactions
- IBAN
- Personal information

This data must only be accessible to the authenticated user.

---

# 3. Authentication

Users must authenticate before accessing private data.

Unauthenticated users must not be able to access:

- Payslips
- Payroll
- Work history
- Expenses
- Financial data
- Bank data

---

# 4. Authorization

Every user-specific API request must verify ownership.

Example:

```text
User A
  ↓
Request payslip
  ↓
Backend checks ownership
  ↓
Allow / Deny
```

Never trust a `user_id` supplied by the frontend.

The backend must determine the authenticated user.

---

# 5. Data Isolation

Users must never be able to access another user's data.

This applies to:

- Database records
- Uploaded files
- Payslips
- Financial records
- Bank transactions
- API responses

---

# 6. Passwords

PayTrack must never store passwords in plain text.

If password authentication is implemented, passwords must be securely hashed using a modern password-hashing algorithm.

Do not implement custom password hashing.

---

# 7. Sessions

Authentication sessions must be securely managed.

Use secure mechanisms such as:

- Secure cookies where appropriate
- HttpOnly cookies where appropriate
- CSRF protection where required
- Short-lived access tokens when token-based authentication is used
- Secure refresh-token handling

Do not store sensitive authentication tokens in insecure browser storage unless there is a strong reason.

---

# 8. API Security

Backend APIs must:

- Authenticate requests
- Authorize resources
- Validate input
- Reject malformed requests
- Apply reasonable rate limits where necessary

Never trust frontend validation alone.

---

# 9. Input Validation

All user input must be validated on the backend.

Examples:

```text
Hours
Dates
Money amounts
Shift times
Expense amounts
File uploads
AI output
```

Invalid input must be rejected.

---

# 10. File Upload Security

Payslip uploads must be treated as untrusted files.

The backend must:

- Accept only supported file types
- Validate file type
- Apply reasonable file-size limits
- Generate safe internal filenames
- Prevent path traversal
- Prevent executable file uploads
- Avoid exposing storage paths directly

Uploaded PDFs must not be executed as code.

---

# 11. File Access

Payslip files must not be publicly accessible.

A user should only be able to access their own uploaded files.

If signed URLs are used, they should:

- Expire
- Be scoped to the requested file
- Not expose permanent public access

---

# 12. AI Privacy

Payslip data may be sent to external AI providers for parsing.

The application must clearly define this behavior.

Only the minimum required data should be sent.

The system should avoid sending unrelated personal information to the AI provider.

---

# 13. AI Provider API Keys

Groq and Cerebras API keys must never be exposed to the frontend.

They must remain on the backend.

Never place provider API keys in:

- Frontend source code
- Public environment variables
- Client-side JavaScript
- Git repositories

---

# 14. AI Output Security

AI output must be treated as untrusted input.

The backend must:

```text
AI output
   ↓
Schema validation
   ↓
Sanitization
   ↓
Application
```

Never execute AI-generated code.

Never directly construct database queries from AI output.

---

# 15. Prompt Injection

Uploaded documents may contain malicious or unexpected text.

The payslip parser must treat document content as **data**, not instructions.

Example:

```text
Payslip text:
"Ignore previous instructions..."
```

The parser must not follow such instructions.

Only the predefined extraction task should be followed.

---

# 16. Database Security

Use parameterized queries or a trusted ORM.

Never construct SQL queries by directly concatenating user input.

Example of prohibited behavior:

```text
"SELECT * FROM users WHERE id = " + userInput
```

---

# 17. Secrets

Secrets must be stored in environment variables or a secure secret-management system.

Examples:

```text
DATABASE_URL
AUTH_SECRET
GROQ_API_KEY
CEREBRAS_API_KEY
BANKING_PROVIDER_SECRET
```

Never commit secrets to Git.

---

# 18. Environment Separation

Use separate configurations for:

```text
Development
Testing
Production
```

Production credentials must never be used in local development.

---

# 19. HTTPS

Production traffic must use HTTPS.

Sensitive information must never be transmitted over plain HTTP.

---

# 20. Logging

Logs must not contain sensitive information unnecessarily.

Do not log:

- Passwords
- API keys
- Authentication tokens
- Full IBANs
- Full payslip contents
- Sensitive financial information

Use masked values when debugging is necessary.

Example:

```text
IBAN: ****1234
```

---

# 21. Error Messages

Errors shown to users must not expose:

- Database details
- API keys
- Stack traces
- Internal file paths
- Provider credentials
- SQL queries

Detailed technical errors may be stored securely in server logs.

---

# 22. Data Encryption

Sensitive data should be encrypted:

### In transit

Use HTTPS/TLS.

### At rest

Use encryption provided by the database, file storage, and hosting infrastructure where available.

Highly sensitive secrets should have additional protection where appropriate.

---

# 23. Data Minimization

Only store information that PayTrack actually needs.

Do not collect unnecessary personal information.

For example, if the application only needs:

```text
Name
Email
Payroll data
Financial data
```

do not collect unrelated personal information.

---

# 24. Data Deletion

The user should eventually be able to delete:

- Payslips
- Expenses
- Work records
- Financial data
- Bank connections
- Account data

Account deletion should remove or anonymize associated personal data according to the application's retention policy and applicable legal requirements.

---

# 25. Bank Integration Security

Bank integration must use official Open Banking / PSD2 authorization flows.

PayTrack must never request:

- ING password
- ING PIN
- Bank authentication codes

PayTrack should use the banking provider's authorization mechanism.

Bank access should be read-only for the initial implementation.

---

# 26. Bank Tokens

Banking access tokens and refresh tokens are sensitive credentials.

They must:

- Never be exposed to the frontend unnecessarily
- Never be logged
- Be encrypted/protected at rest
- Be revocable
- Be deleted when the connection is removed

---

# 27. No Financial Actions

PayTrack must not perform financial actions.

The application must not:

- Transfer money
- Make payments
- Withdraw money
- Change bank settings

The initial banking functionality is read-only.

---

# 28. Third-Party Services

External services may include:

```text
AI provider
File storage
Open Banking provider
Email provider
Authentication provider
```

The application should minimize the data shared with each service.

---

# 29. GDPR

PayTrack may process personal data of users in the European Union.

The application should be designed with GDPR principles in mind:

- Data minimization
- Purpose limitation
- Security
- Transparency
- User control
- Data deletion
- Appropriate retention

The final production implementation must be reviewed against applicable GDPR requirements.

---

# 30. Data Retention

The application should not keep sensitive data indefinitely without a reason.

Retention periods should be configurable or documented.

The user should be able to delete data that no longer needs to be stored, subject to applicable legal requirements.

---

# 31. Backup Security

Backups may contain sensitive financial information.

Backups must:

- Be access-controlled
- Be encrypted where supported
- Not be publicly accessible
- Have an appropriate retention period

---

# 32. Dependency Security

Third-party dependencies should be kept reasonably up to date.

The project should periodically check for:

- Known vulnerabilities
- Outdated dependencies
- Security advisories

Do not blindly update major versions without testing.

---

# 33. Frontend Security

The frontend must:

- Avoid exposing secrets
- Sanitize untrusted content
- Use secure authentication mechanisms
- Avoid unsafe HTML rendering
- Validate user input for UX
- Never rely on frontend authorization

Backend authorization is always authoritative.

---

# 34. Production Checklist

Before production:

```text
[ ] HTTPS enabled
[ ] Authentication enabled
[ ] Authorization tested
[ ] User data isolation tested
[ ] Secrets removed from source code
[ ] API keys protected
[ ] File upload restrictions enabled
[ ] Database protected
[ ] Error messages reviewed
[ ] Sensitive logging removed
[ ] Backups protected
[ ] Dependencies checked
[ ] AI provider data handling reviewed
[ ] Bank integration security reviewed
```

---

# 35. Core Security Rules

1. Never trust the frontend.
2. Never expose secrets.
3. Never store passwords in plain text.
4. Never expose another user's data.
5. Never make payslips publicly accessible.
6. Treat uploaded files as untrusted.
7. Treat AI output as untrusted.
8. Keep AI API keys on the backend.
9. Never request bank credentials directly.
10. Keep banking read-only.
11. Minimize stored personal data.
12. Protect sensitive data in transit and at rest.
13. Do not log sensitive information.
14. Validate every important input on the backend.
15. Security must not be sacrificed for convenience.