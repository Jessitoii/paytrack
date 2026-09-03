import type { IncomingMessage, ServerResponse } from 'http';
import { handleCors, sendHtml } from './lib/cors';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PayTrack - Privacy Policy</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0B1120;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      padding: 48px 24px;
    }
    header {
      border-bottom: 1px solid #1E293B;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    h1 {
      font-size: 28px;
      color: #38BDF8;
      margin: 0 0 8px 0;
      font-weight: 700;
    }
    .subtitle {
      color: #94A3B8;
      font-size: 14px;
    }
    h2 {
      font-size: 18px;
      color: #F8FAFC;
      margin: 32px 0 12px 0;
      font-weight: 600;
    }
    p, li {
      color: #94A3B8;
      font-size: 15px;
    }
    ul {
      padding-left: 20px;
      margin: 12px 0;
    }
    li {
      margin-bottom: 6px;
    }
    .card {
      background-color: #131C31;
      border: 1px solid #1E293B;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .badge {
      display: inline-block;
      background-color: rgba(56, 189, 248, 0.15);
      color: #38BDF8;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #1E293B;
      font-size: 13px;
      color: #64748B;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge">Personal & Non-Commercial Use</div>
      <h1>Privacy Policy</h1>
      <div class="subtitle">Effective Date: September 2026 &bull; PayTrack Open Banking</div>
    </header>

    <div class="card">
      <strong style="color: #38BDF8;">Privacy at a Glance:</strong>
      <p style="margin: 8px 0 0 0;">PayTrack is built on a <strong>local-first architecture</strong>. Your shifts, payslips, personal budget, and financial transactions reside in an isolated SQLite database on your device. We do not sell your personal information or use tracking cookies.</p>
    </div>

    <h2>1. Introduction</h2>
    <p>PayTrack is an open-source, personal financial and shift management application designed to help workers track hourly shifts, estimate Dutch CAO payroll, and manage personal expenses. This Privacy Policy describes how data is handled when using PayTrack, specifically including bank connectivity via Enable Banking.</p>

    <h2>2. Open Banking & Account Information Services (AIS)</h2>
    <p>To provide account balance display and transaction categorization, PayTrack utilizes the Open Banking API provided by <strong>Enable Banking AS</strong> (a licensed Account Information Service Provider regulated under European PSD2 legislation):</p>
    <ul>
      <li><strong>Read-Only Access:</strong> PayTrack requests read-only access strictly for account details, balances, and booked/pending transactions. PayTrack cannot initiate payments, move funds, or make changes to your bank account.</li>
      <li><strong>Direct Bank Authentication:</strong> Authentication and consent take place directly on your bank's official portal (e.g., ING Netherlands). PayTrack never handles, stores, or sees your bank login credentials, passwords, or two-factor authentication codes.</li>
      <li><strong>Consent Duration:</strong> Bank access is granted based on your consent for up to 90 days. You may revoke consent at any time directly in the app or via your bank's consent manager.</li>
    </ul>

    <h2>3. Data Storage & Local Isolation</h2>
    <p>All imported bank transactions, account balances, and categorized expenses are stored locally in your device's private SQLite database. No external database or persistent centralized server stores your financial transactions.</p>

    <h2>4. Third-Party Services & Serverless Architecture</h2>
    <ul>
      <li><strong>Enable Banking AS:</strong> Facilitates the PSD2-compliant connection between your bank and PayTrack. Data processed through Enable Banking is governed by their security and regulatory obligations.</li>
      <li><strong>Serverless Functions:</strong> Stateless endpoints (hosted on Vercel) act solely as a secure proxy to sign API requests with application credentials. No user transaction records are persisted in serverless memory or logs.</li>
    </ul>

    <h2>5. Data Retention & Deletion</h2>
    <p>You have complete control over your data:</p>
    <ul>
      <li><strong>Disconnecting Bank:</strong> Tapping "Disconnect" in the Finance section revokes the authorization session with Enable Banking and halts further synchronization.</li>
      <li><strong>Local Data Wipe:</strong> You can delete all transactions, accounts, and application data at any time via Settings &rarr; Reset Database.</li>
    </ul>

    <h2>6. Contact</h2>
    <p>For questions regarding this privacy policy or the PayTrack application, please open an issue on the official GitHub repository at <a href="https://github.com/Jessitoii/PayTrack" style="color: #38BDF8; text-decoration: none;">github.com/Jessitoii/PayTrack</a>.</p>

    <footer>
      &copy; 2026 PayTrack. Designed for personal financial transparency.
    </footer>
  </div>
</body>
</html>
  `.trim();

  sendHtml(res, 200, html);
}
