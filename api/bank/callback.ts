import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { handleCors, sendHtml } from '../lib/cors';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const ref = parsedUrl.searchParams.get('ref') || '';
  const status = parsedUrl.searchParams.get('status') || 'success';
  const error = parsedUrl.searchParams.get('error') || '';

  const deepLink = `paytrack://bank-callback?ref=${encodeURIComponent(ref)}&status=${encodeURIComponent(status)}&error=${encodeURIComponent(error)}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PayTrack - Bank Connection Complete</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0B1120;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
    }
    .card {
      background-color: #131C31;
      border: 1px solid #1E293B;
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 380px;
      margin: 20px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: #34D399;
    }
    p {
      color: #94A3B8;
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-block;
      background-color: #10B981;
      color: #041F14;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 10px;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: #34D399;
    }
    .note {
      font-size: 12px;
      color: #64748B;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🏦</div>
    <h1>Bank Authorization Complete</h1>
    <p>Your bank connection with ING Netherlands has been authorized. Returning to PayTrack...</p>
    <a href="${deepLink}" class="btn">Open PayTrack</a>
    <div class="note">If the app does not open automatically, tap the button above.</div>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "${deepLink}";
    }, 400);
  </script>
</body>
</html>
  `.trim();

  sendHtml(res, 200, html);
}
