# GoCardless Bank Account Data & ING Netherlands Open Banking Setup (Serverless Architecture)

This guide explains how to configure and deploy the GoCardless Bank Account Data API (PSD2 Open Banking) Serverless Functions to connect ING Netherlands accounts and import transactions in PayTrack.

---

## 1. Architecture Overview

PayTrack uses a **Serverless + Local SQLite Architecture**:

```text
React Native / Expo Mobile App
        │
        │ HTTPS
        ▼
Serverless Functions (/api/bank/*)
        │
        │ GoCardless Secret ID / Secret Key (Server-Only Secrets)
        ▼
GoCardless Bank Account Data API (v2)
        │
        ▼
ING Netherlands (PSD2 Consent Flow)
```

- **Frontend**: 100% Expo / React Native with local-first SQLite (`expo-sqlite`).
- **Serverless Functions**: Stateless HTTP handlers located in `/api/bank/*` (deployable to Vercel, Netlify, or standard serverless runtimes).
- **Secrets Isolation**: GoCardless `secret_id` and `secret_key` reside exclusively in serverless environment variables. The mobile app never receives or bundles these secrets.

---

## 2. Obtaining GoCardless API Credentials (User Secrets)

1. Register or log in to the [GoCardless Bank Account Data Portal](https://bankaccountdata.gocardless.com/).
2. Navigate to **User Secrets** in the dashboard menu.
3. Click **Create new User Secret**.
4. You will receive:
   - **Secret ID** (`secret_id`)
   - **Secret Key** (`secret_key`)
5. Copy the Secret Key immediately.

---

## 3. Serverless Environment Variables Configuration

In your serverless deployment dashboard (e.g. Vercel Project Settings &rarr; Environment Variables):

| Variable | Description | Security Scope |
|----------|-------------|----------------|
| `GC_SECRET_ID` | GoCardless User Secret ID | **Serverless Only (Never expose to client)** |
| `GC_SECRET_KEY` | GoCardless User Secret Key | **Serverless Only (Never expose to client)** |
| `GC_REDIRECT_URI` | `https://<your-domain>/api/bank/callback` | Serverless Only |
| `BANK_PROVIDER_MODE` | `gocardless` (production) or `auto` / `mock` | Serverless Only |

In your local or build environment for the Expo mobile app:

| Variable | Description | Security Scope |
|----------|-------------|----------------|
| `EXPO_PUBLIC_API_URL` | `https://<your-domain>` (Base URL of serverless functions) | Public Client Safe |

---

## 4. Serverless Endpoints Reference

All banking operations run statelessly via `/api/bank/*`:

- `GET /api/bank/health`: Verifies serverless function runtime status and mode.
- `GET /api/bank/institutions?country=NL`: Lists available Dutch banks with ING Netherlands prioritized.
- `POST /api/bank/connect`: Creates a requisition with GoCardless and returns the ING authorization URL.
- `GET /api/bank/callback`: Handles redirect from ING after user grants consent, rendering a responsive redirect that deep links back to `paytrack://bank-callback`.
- `GET /api/bank/accounts?requisitionId=...`: Retrieves authorized account details, balances, and masked IBANs.
- `POST /api/bank/sync`: Fetches booked transactions and updated balances from GoCardless.
- `POST /api/bank/disconnect`: Calls GoCardless to revoke and delete the bank requisition.

---

## 5. End-to-End User Flow (ING Netherlands)

1. User opens PayTrack and navigates to the **Finance** tab.
2. At the top of the **Overview** tab, the user taps **Connect ING Netherlands**.
3. The app opens the ING authorization URL via in-app browser (`expo-web-browser`).
4. User authenticates with ING and gives consent to read accounts and transactions.
5. ING redirects back to `https://<your-domain>/api/bank/callback`, which immediately deep-links into `paytrack://bank-callback`.
6. The app receives the callback, fetches account metadata, and performs an initial transaction import into local SQLite.
7. Balance and recent transactions are displayed in the modern bank card.

---

## 6. Duplicate Prevention & Rent Matching

- **Unique Constraint**: Transactions are saved with a composite unique constraint on `(bankAccountId, gocardlessTransactionId)` using `INSERT OR IGNORE`. Repeated syncs will never produce duplicate records.
- **Weekly €160 Rent Matching**:
  - The built-in €160 weekly Monday rent rule is preserved.
  - Transactions matching weekly rent are tagged with `isRentMatch = 1` and excluded from variable expense calculations to prevent double-counting.
- **Manual Expenses**: Manual expenses continue to be tracked with `source = 'MANUAL'`.

---

## 7. Disconnecting

When the user taps **Disconnect**:
1. PayTrack calls `POST /api/bank/disconnect` to revoke the requisition with GoCardless.
2. Local connection status is set to `DISCONNECTED`.
3. Historical imported transactions are safely retained in SQLite for financial continuity.
