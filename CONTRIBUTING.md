# Contributing to PayTrack

Thank you for your interest in contributing to PayTrack. PayTrack is a local-first mobile application engineered for precision shift tracking, Dutch CAO payroll estimation, and personal finance management.

## Development Workflow

### Prerequisites
- **Node.js**: v20+ or v22+
- **npm**: v10+
- **Expo CLI**: bundled via `npx expo`
- **Optional**: Google Chrome or Microsoft Edge (for automated headless screenshot generation)

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Jessitoii/PayTrack.git
   cd PayTrack
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the automated test suite:
   ```bash
   npm test
   ```
4. Run strict TypeScript validation:
   ```bash
   npm run typecheck
   ```

## Code Guidelines

### 1. Deterministic Calculation Rules
- Financial and payroll computations **must remain strictly deterministic** and encapsulated within pure utility functions or tested repositories.
- Use `decimal.js` for rounding-sensitive financial operations where binary floating-point inaccuracy could introduce cent-level errors.
- Never introduce non-deterministic heuristics into core payroll formulas.

### 2. Local-First Architecture
- All user data resides in local SQLite storage (`expo-sqlite` on devices, `better-sqlite3` in test harnesses).
- Repository methods must maintain transactional consistency and cascade relationships.
- Do not introduce mandatory network dependencies or background telemetry.

### 3. Testing Requirements
- Every new payroll rule, parser regex pattern, or repository query must be covered by a unit or integration test in `tests/`.
- Ensure all tests pass prior to submitting pull requests (`npm test`).

### 4. Pull Requests
- Open a concise PR linking to any relevant issue.
- Verify that both `npm test` and `npm run typecheck` pass cleanly.
