import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { handleCors, sendJson } from '../_lib/cors';
import {
  exchangeCodeForSession,
  getSession,
  getCachedSession,
  getAccountDetails,
  getAccountBalances,
  verifySignedSessionToken,
  redactId,
  isMockMode,
} from '../_lib/enableBanking';
import {
  mockGetSession,
  mockGetAccountDetails,
  mockGetAccountBalances,
} from '../_lib/mock';
import { BankAccountBalances } from '../_lib/types';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  try {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const sessionId = parsedUrl.searchParams.get('sessionId') || parsedUrl.searchParams.get('requisitionId');
    const authToken = parsedUrl.searchParams.get('authToken') || parsedUrl.searchParams.get('auth_token');
    const code = parsedUrl.searchParams.get('code');
    const state = parsedUrl.searchParams.get('state');

    // Stateless signed token recovery: extracts verified sessionId across independent serverless instances
    let effectiveSessionId = sessionId;
    if (!effectiveSessionId && authToken) {
      const verified = verifySignedSessionToken(authToken);
      if (verified?.sessionId) {
        effectiveSessionId = verified.sessionId;
        console.log(`[EnableBanking Accounts] Recovered session ID from signed authToken: id=${redactId(effectiveSessionId)}`);
      }
    }

    if (!effectiveSessionId && !code && !state) {
      console.warn('[Accounts Diagnostic] Missing all identifiers: returning 400 BANK_PARAM_MISSING');
      sendJson(res, 400, {
        error: 'Missing sessionId, authToken, code, or state parameter.',
        code: 'BANK_PARAM_MISSING',
      });
      return;
    }

    console.log(`[Accounts Diagnostic] Request: hasSessionId=${Boolean(sessionId)}, hasAuthToken=${Boolean(authToken)}, hasEffectiveSessionId=${Boolean(effectiveSessionId)}, hasCode=${Boolean(code)}, hasState=${Boolean(state)}`);

    const mock = isMockMode();

    let resolvedSessionId = effectiveSessionId;
    let sessionData: any = null;

    if (mock) {
      sessionData =
        (effectiveSessionId ? getCachedSession(effectiveSessionId) : null) ||
        (state ? getCachedSession(state) : null) ||
        (code ? getCachedSession(code) : null) ||
        (effectiveSessionId || code ? mockGetSession(effectiveSessionId || 'session_mock') : null);
      resolvedSessionId = sessionData?.id;
    } else {
      // 1. If effectiveSessionId is provided, fetch existing authorized session directly from Enable Banking
      if (effectiveSessionId) {
        console.log(`[EnableBanking Accounts] Fetching session details for sessionId: id=${redactId(effectiveSessionId)}`);
        sessionData = await getSession(effectiveSessionId);
      }
      // 2. If no sessionId, but state is provided, check if session is cached under state
      else if (state && getCachedSession(state)) {
        console.log(`[EnableBanking Accounts] Found session in cache for state`);
        sessionData = getCachedSession(state);
      }
      // 3. If code is provided, check cache first to avoid duplicate exchange errors
      else if (code) {
        const cached = getCachedSession(code) || (state ? getCachedSession(state) : null);
        if (cached) {
          console.log(`[EnableBanking Accounts] Found session in cache for code/state: id=${redactId(cached.id)}`);
          sessionData = cached;
        } else {
          console.log('[EnableBanking Accounts] Exchanging code for session...');
          sessionData = await exchangeCodeForSession(code, state || undefined);
        }
      }
      // 4. Fallback: check cache for state
      else if (state) {
        console.log(`[EnableBanking Accounts] Checking session cache for state...`);
        sessionData = getCachedSession(state);
      }

      resolvedSessionId = sessionData?.id || sessionData?.session_id || effectiveSessionId;
    }

    if (!sessionData) {
      // Do NOT convert a cache miss into 404 BANK_REAUTH_REQUIRED!
      // Return 202 BANK_AUTH_RESULT_NOT_READY so mobile can retry or await deep link.
      console.warn('[Accounts Diagnostic] Session data not ready (cache miss or pending callback). Returning HTTP 202 BANK_AUTH_RESULT_NOT_READY');
      sendJson(res, 202, {
        error: 'Bank authorization is still being finalized. Please retry.',
        code: 'BANK_AUTH_RESULT_NOT_READY',
        reauthRequired: false,
        message: 'Bank authorization is still being finalized. Please retry.',
      });
      return;
    }

    const rawAccountsList: any[] = sessionData?.rawAccounts || sessionData?.accounts || [];
    console.log(`[Accounts Diagnostic] Accounts resolved successfully: count=${rawAccountsList.length}, hasResolvedSessionId=${Boolean(resolvedSessionId)}`);

    const accountsWithDetails = await Promise.all(
      rawAccountsList.map(async (accItem: any) => {
        try {
          const accUid = typeof accItem === 'string' ? accItem : (accItem.uid || accItem.id || accItem.account_id?.iban);
          if (!accUid) return null;

          const iban = typeof accItem === 'object' ? (accItem.account_id?.iban || accItem.iban || '') : '';
          const identificationHash = typeof accItem === 'object' ? (accItem.identification_hash || accItem.identificationHash || null) : null;
          const holderName = typeof accItem === 'object' ? (accItem.party_name || accItem.name || '') : '';
          const currency = typeof accItem === 'object' ? (accItem.currency || 'EUR') : 'EUR';

          let balances: BankAccountBalances = { balance: 0.0, availableBalance: null, currency };
          try {
            balances = mock
              ? mockGetAccountBalances(accUid)
              : await getAccountBalances(accUid);
          } catch (balErr: any) {
            console.warn(`[EnableBanking Accounts] Could not fetch balances for account: ${balErr?.message}`);
          }

          let details: any = null;
          try {
            details = mock
              ? mockGetAccountDetails(accUid)
              : await getAccountDetails(accUid, 'ING Netherlands');
          } catch (_) {}

          const resolvedIban = details?.iban || iban;
          const displayIban = resolvedIban.startsWith('NL') ? resolvedIban : (resolvedIban ? `NL${resolvedIban}` : 'NL00INGB0000000000');

          return {
            id: accUid, // CRITICAL: This is the real account UID for balances/transactions!
            identificationHash,
            iban: displayIban,
            accountName: details?.accountName || holderName || 'ING Betaalrekening',
            currency: balances.currency || currency,
            balance: balances.balance,
            availableBalance: balances.availableBalance,
            status: details?.status || 'READY',
            bankName: details?.bankName || 'ING Netherlands',
          };
        } catch (err: any) {
          console.error(`[EnableBanking Accounts] Error for account:`, err?.message);
          return null;
        }
      })
    );

    const validAccounts = accountsWithDetails.filter(Boolean);

    sendJson(res, 200, {
      sessionId: resolvedSessionId,
      requisitionId: resolvedSessionId, // backward compatibility
      status: 'AUTHORIZED',
      accounts: validAccounts,
    });
  } catch (err: any) {
    const isAlreadyAuthorized =
      err?.code === 'BANK_AUTH_SESSION_ALREADY_AUTHORIZED' ||
      err?.message?.includes('already authorized') ||
      err?.message?.includes('ALREADY_AUTHORIZED');

    if (isAlreadyAuthorized) {
      console.warn('[EnableBanking Accounts] Session already authorized, returning structured 422');
      sendJson(res, 422, {
        error: 'Bank authorization already completed; recovering the existing session.',
        code: 'BANK_AUTH_SESSION_ALREADY_AUTHORIZED',
        reauthRequired: false,
        details: err?.message,
      });
      return;
    }

    const is404 =
      err?.statusCode === 404 ||
      err?.code === 'BANK_SESSION_NOT_FOUND' ||
      err?.message?.includes('404');

    console.error('[Enable Banking accounts error]', err?.message);

    sendJson(res, is404 ? 404 : 500, {
      error: is404
        ? 'Bank session not found or expired. Reauthorization required.'
        : 'Failed to retrieve accounts from Enable Banking',
      code: is404 ? 'BANK_REAUTH_REQUIRED' : 'BANK_AUTH_FAILED',
      reauthRequired: is404,
      details: err?.message,
    });
  }
}
