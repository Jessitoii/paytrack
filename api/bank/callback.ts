import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { handleCors, sendHtml } from '../_lib/cors';
import { exchangeCodeForSession, isMockMode } from '../_lib/enableBanking';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const code = parsedUrl.searchParams.get('code') || '';
  const state = parsedUrl.searchParams.get('state') || '';
  let sessionId = parsedUrl.searchParams.get('session_id') || parsedUrl.searchParams.get('ref') || '';
  const error = parsedUrl.searchParams.get('error') || '';
  const errorDescription = parsedUrl.searchParams.get('error_description') || '';

  let status = error ? 'error' : 'success';

  // If code is received and we don't have a session ID yet, exchange it for session
  if (code && !sessionId && status === 'success') {
    if (isMockMode()) {
      sessionId = `session_${code}`;
    } else {
      try {
        const session = await exchangeCodeForSession(code);
        sessionId = session.id;
      } catch (err: any) {
        console.error('[Enable Banking callback code exchange error]', err);
        status = 'error';
      }
    }
  }

  const deepLink = `paytrack://bank-callback?session_id=${encodeURIComponent(sessionId)}&ref=${encodeURIComponent(sessionId)}&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&status=${encodeURIComponent(status)}&error=${encodeURIComponent(error || errorDescription)}`;

  const isSuccess = status === 'success';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PayTrack - ING Connection Complete</title>
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
      padding: 36px 28px;
      max-width: 400px;
      margin: 20px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.6);
    }
    .icon {
      font-size: 52px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 10px 0;
      color: ${isSuccess ? '#34D399' : '#F87171'};
    }
    p {
      color: #94A3B8;
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-block;
      background-color: ${isSuccess ? '#10B981' : '#EF4444'};
      color: #041F14;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 10px;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .note {
      font-size: 12px;
      color: #64748B;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? '🏦' : '⚠️'}</div>
    <h1>${isSuccess ? 'ING Authorization Complete' : 'Connection Incomplete'}</h1>
    <p>${
      isSuccess
        ? 'Your bank connection with ING Netherlands has been authorized via Enable Banking. Returning to PayTrack...'
        : 'Bank authorization could not be completed. Please return to PayTrack and try again.'
    }</p>
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
