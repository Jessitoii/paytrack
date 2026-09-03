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
  <title>PayTrack - Terms of Use</title>
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
      color: #10B981;
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
      background-color: rgba(16, 185, 129, 0.15);
      color: #10B981;
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
      <div class="badge">Open Source & Personal Use</div>
      <h1>Terms of Use</h1>
      <div class="subtitle">Effective Date: September 2026 &bull; PayTrack Application</div>
    </header>

    <div class="card">
      <strong style="color: #10B981;">Purpose & Scope:</strong>
      <p style="margin: 8px 0 0 0;">PayTrack is provided as an open-source, non-commercial productivity and financial tracking tool for individual personal use. By accessing or using PayTrack, you agree to these Terms of Use.</p>
    </div>

    <h2>1. Personal, Non-Commercial License</h2>
    <p>PayTrack is licensed for individual personal use. You may use the software to track your personal work shifts, calculate CAO wage estimations, and organize your household finances.</p>

    <h2>2. Open Banking Services</h2>
    <p>Bank data synchronization is provided through the Enable Banking API under European PSD2 regulations:</p>
    <ul>
      <li>You authorize PayTrack to connect with your financial institution (such as ING Netherlands) through Enable Banking solely to retrieve read-only account and transaction information.</li>
      <li>PayTrack is not a bank, financial institution, or credit advisor. All financial calculations and payroll estimations are provided for budgeting and informational purposes only.</li>
      <li>You may revoke Open Banking authorization at any time by disconnecting your account in the application.</li>
    </ul>

    <h2>3. Disclaimer of Financial & Legal Advice</h2>
    <p>While PayTrack strives for precision in its deterministic CAO calculations, payroll rules and bank feeds are subject to regulatory updates and employer variations. PayTrack does not provide certified financial, accounting, or legal advice. Always refer to your official employer payslips and bank statements for formal tax and legal compliance.</p>

    <h2>4. Limitation of Liability</h2>
    <p>The software is provided "as is", without warranty of any kind, express or implied. Under no circumstances shall the developers or contributors be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use the software.</p>

    <h2>5. Modifications</h2>
    <p>These terms may be updated periodically to reflect new features or regulatory requirements. Continued use of PayTrack constitutes acceptance of any revised terms.</p>

    <h2>6. Contact & Source Code</h2>
    <p>The source code and developer documentation are accessible at <a href="https://github.com/Jessitoii/PayTrack" style="color: #10B981; text-decoration: none;">github.com/Jessitoii/PayTrack</a>.</p>

    <footer>
      &copy; 2026 PayTrack. Empowering workers with financial clarity.
    </footer>
  </div>
</body>
</html>
  `.trim();

  sendHtml(res, 200, html);
}
