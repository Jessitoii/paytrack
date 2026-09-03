import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { handleCors, sendHtml } from '../_lib/cors';
import {
  exchangeCodeForSession,
  getCachedSession,
  setCachedSession,
  createSignedSessionToken,
  redactId,
  isMockMode,
} from '../_lib/enableBanking';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const code = parsedUrl.searchParams.get('code') || '';
  const state = parsedUrl.searchParams.get('state') || '';
  let sessionId = parsedUrl.searchParams.get('session_id') || parsedUrl.searchParams.get('ref') || '';
  const error = parsedUrl.searchParams.get('error') || '';
  const errorDescription = parsedUrl.searchParams.get('error_description') || '';

  let status = error ? 'error' : 'success';
  let appRedirectUrl = 'paytrack://bank-callback';

  console.log(`[Callback Diagnostic] Reached: codeExists=${Boolean(code)}, stateExists=${Boolean(state)}, initialStatus=${status}, errorExists=${Boolean(error || errorDescription)}`);

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      if (decoded?.appRedirectUrl) {
        appRedirectUrl = decoded.appRedirectUrl;
      }
    } catch (_) {}
  }

  console.log(`[Callback Diagnostic] appRedirectUrlScheme=${appRedirectUrl.split('://')[0]}, hasCustomUrl=${appRedirectUrl !== 'paytrack://bank-callback'}`);

  // 1. Check if session was already cached by state or code (idempotent callback handling)
  if (!sessionId) {
    const cached = (code ? getCachedSession(code) : null) || (state ? getCachedSession(state) : null);
    if (cached) {
      sessionId = cached.id;
      console.log(`[EnableBanking Callback] Reusing existing cached session: id=${redactId(sessionId)}`);
    }
  }

  // 2. If code is received and not already exchanged, exchange it for session
  if (code && !sessionId && status === 'success') {
    if (isMockMode()) {
      sessionId = `session_${code}`;
      setCachedSession(
        {
          id: sessionId,
          status: 'AUTHORIZED',
          accounts: ['NL91INGB0001234567'],
          rawAccounts: [
            {
              uid: 'NL91INGB0001234567',
              account_id: { iban: 'NL91INGB0001234567' },
              identification_hash: 'hash_mock_ing',
              currency: 'EUR',
            },
          ],
          institutionId: 'ING',
          institutionName: 'ING Netherlands',
          createdAt: new Date().toISOString(),
        },
        state,
        code
      );
    } else {
      try {
        console.log('[Callback Diagnostic] Initiating POST /sessions exchange...');
        const session = await exchangeCodeForSession(code, state);
        sessionId = session.id;
        console.log(`[Callback Diagnostic] POST /sessions succeeded: hasSessionId=${Boolean(sessionId)}`);
      } catch (err: any) {
        console.warn(`[Callback Diagnostic] POST /sessions error: message=${err?.message}, code=${err?.code}`);
        if (err?.code === 'BANK_AUTH_SESSION_ALREADY_AUTHORIZED') {
          console.warn('[EnableBanking Callback] Session already authorized. Attempting cache recovery...');
          const cached = (code ? getCachedSession(code) : null) || (state ? getCachedSession(state) : null);
          if (cached) {
            sessionId = cached.id;
            status = 'success';
          } else {
            console.warn('[EnableBanking Callback] Session authorized on Enable Banking; propagating already_authorized state');
            status = 'already_authorized';
          }
        } else {
          console.error('[Enable Banking callback code exchange error]', err?.message);
          status = 'error';
        }
      }
    }
  }

  // Generate stateless signed authorization token for cross-instance verification
  const authToken = sessionId ? createSignedSessionToken(sessionId, state) : '';

  console.log(`[Callback Diagnostic] Redirect deep link created: scheme=${appRedirectUrl.split('://')[0]}, hasSessionId=${Boolean(sessionId)}, hasAuthToken=${Boolean(authToken)}, status=${status}`);

  const querySep = appRedirectUrl.includes('?') ? '&' : '?';
  const queryParts = [
    sessionId ? `session_id=${encodeURIComponent(sessionId)}` : '',
    sessionId ? `ref=${encodeURIComponent(sessionId)}` : '',
    authToken ? `auth_token=${encodeURIComponent(authToken)}` : '',
    !sessionId && code ? `code=${encodeURIComponent(code)}` : '',
    state ? `state=${encodeURIComponent(state)}` : '',
    `status=${encodeURIComponent(status)}`,
    error || errorDescription ? `error=${encodeURIComponent(error || errorDescription)}` : '',
  ].filter(Boolean).join('&');

  const deepLink = `${appRedirectUrl}${querySep}${queryParts}`;

  const isSuccess = status === 'success' || status === 'already_authorized';

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
    try {
      if (window.history && window.history.replaceState && "${sessionId}") {
        window.history.replaceState({}, '', window.location.pathname + '?session_id=' + encodeURIComponent("${sessionId}") + '&status=${status}');
      }
    } catch (_) {}
    setTimeout(function() {
      window.location.href = "${deepLink}";
    }, 400);
  </script>
</body>
</html>
  `.trim();

  sendHtml(res, 200, html);
}
