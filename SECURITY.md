# Security Policy

## Security Model

PayTrack is architected as an **offline-first, local-first** mobile application.

- **Local Storage**: All shift records, payroll configurations, payslip extractions, and financial transactions are stored locally on the device in an isolated SQLite database (`paytrack_local.db`).
- **Zero Telemetry**: The application does not collect, transmit, or monetize personal or financial data.
- **Document Processing**: Payslip OCR and text extraction occur locally on the device without sending document contents to third-party endpoints.

## Reporting a Vulnerability

If you discover a security vulnerability or sensitive data leak in PayTrack, please report it responsibly:

1. **Do not create a public GitHub issue.**
2. Email details of the issue to the maintainer at `alper@paytrack.app` or contact via GitHub security advisory.
3. Include:
   - Description of the issue
   - Reproduction steps or proof of concept
   - Impact assessment

You will receive an acknowledgment within 48 hours, followed by a coordinated fix and disclosure timeline.
