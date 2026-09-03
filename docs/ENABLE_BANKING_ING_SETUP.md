# Enable Banking & ING Netherlands Open Banking Setup (Serverless Architecture)

This guide provides step-by-step instructions for configuring and deploying the **Enable Banking API** (PSD2 Open Banking) to connect real **ING Netherlands** bank accounts and import transactions in PayTrack.

---

## 1. Architecture Overview

PayTrack uses a **Serverless API + Local SQLite Architecture**:

```text
React Native / Expo Mobile App
        │
        │ HTTPS (EXPO_PUBLIC_API_URL)
        ▼
Vercel Serverless Functions (/api/bank/*)
        │
        │ RS256 JWT (Signed with ENABLE_BANKING_PRIVATE_KEY)
        ▼
Enable Banking API (v2) [api.enablebanking.com]
        │
        ▼
ING Netherlands (PSD2 Consent Portal)
```

- **Frontend**: 100% Expo / React Native with local-first SQLite (`expo-sqlite`).
- **Serverless Functions**: Stateless HTTP handlers located in `/api/bank/*`.
- **Zero Client Secret Leakage**: The application's RSA Private Key and Application ID reside **exclusively in Vercel environment variables**. They are never bundled into the mobile app.

---

## 2. Setting Up Enable Banking Control Panel

1. Register or sign in at the [Enable Banking Control Panel](https://enablebanking.com/cp/).
2. Create a new Application.
3. Configure your Application details:
   - **Application Name**: `PayTrack`
   - **Redirect URI**: `https://<your-vercel-domain>/api/bank/callback`
   - **Privacy Policy URL**: `https://<your-vercel-domain>/privacy`
   - **Terms of Use URL**: `https://<your-vercel-domain>/terms`
4. Generate or upload your RSA key:
   - You can generate a 2048-bit RSA private key via OpenSSL:
     ```bash
     openssl req -x509 -newkey rsa:2048 -keyout private.key -out certificate.pem -days 365 -nodes
     ```
   - Upload `certificate.pem` to the Enable Banking Control Panel.
   - Save your `private.key` securely. **Never commit or share this private key.**
5. Note your **Application ID** assigned in the dashboard.

---

## 3. Vercel Environment Variables Configuration

In your Vercel Project Dashboard under **Project Settings &rarr; Environment Variables**:

| Variable Name | Environment Scope | Value Description |
|---------------|-------------------|-------------------|
| `ENABLE_BANKING_APP_ID` | Production, Preview, Development | Your Enable Banking Application ID (e.g., `app_...` or UUID) |
| `ENABLE_BANKING_PRIVATE_KEY` | Production, Preview, Development | The full RSA private key in PEM format (`-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----`) |
| `ENABLE_BANKING_REDIRECT_URI` | Production, Preview, Development | `https://<your-vercel-domain>/api/bank/callback` |
| `BANK_PROVIDER_MODE` | Production | `enable_banking` (or `auto` / `mock` for local dev) |

> [!CAUTION]
> When pasting `ENABLE_BANKING_PRIVATE_KEY` into Vercel, paste the entire PEM string including header and footer lines. Vercel preserves multiline environment variables securely.

---

## 4. Mobile Client Configuration (`.env`)

In your local environment or EAS build configuration for the Expo mobile app:

| Variable Name | Description |
|---------------|-------------|
| `EXPO_PUBLIC_API_URL` | Base HTTPS URL of your deployed Vercel functions (e.g. `https://paytrack-api.vercel.app`) |

---

## 5. Endpoints Reference

All banking operations run statelessly via `/api/bank/*`:

- `GET /api/bank/health`: Verifies serverless function runtime status and reports provider as `enable_banking`.
- `GET /api/bank/institutions?country=NL`: Lists supported Dutch institutions (prioritizing ING Netherlands).
- `POST /api/bank/connect`: Initiates an authorization session with Enable Banking and returns the bank consent link.
- `GET /api/bank/callback`: Handles the redirect from ING after user consent, exchanges the authorization code for an active session, and deep-links back to `paytrack://bank-callback`.
- `GET /api/bank/accounts`: Retrieves authorized accounts, IBANs, and balances.
- `POST /api/bank/sync`: Fetches booked and pending transactions from Enable Banking and updates local SQLite.
- `POST /api/bank/disconnect`: Revokes and deletes the bank session.
- `GET /privacy`: Accessible Privacy Policy required for Enable Banking compliance.
- `GET /terms`: Accessible Terms of Use required for Enable Banking compliance.

---

## 6. Rent Matching & Transaction UPSERT

- **Smart Categorizer**: Transactions are categorized against standard Dutch merchants (Albert Heijn, NS, Kruidvat, Bol.com, Spotify, HollandZorg).
- **Weekly €160 Rent Matching**:
  - The built-in weekly Monday €160 rent rule is preserved.
  - Transactions matching weekly rent are tagged with `isRentMatch = 1` and excluded from variable expense totals to avoid double counting.
  - Non-housing retail transactions of €160 (e.g. MediaMarkt, Zara) are never mistakenly flagged as rent.
- **UPSERT Protection**: Repeated syncs will never duplicate transactions. If a transaction changes from `PENDING` to `BOOKED`, the SQLite database updates the existing transaction record in-place.
