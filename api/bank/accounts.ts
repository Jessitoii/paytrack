import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { handleCors, sendJson } from '../_lib/cors';
import {
  exchangeCodeForSession,
  getSession,
  getAccountDetails,
  getAccountBalances,
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
    const code = parsedUrl.searchParams.get('code');
    const state = parsedUrl.searchParams.get('state');

    if (!sessionId && !code && !state) {
      sendJson(res, 400, {
        error: 'Missing sessionId, code, or state parameter.',
        code: 'BANK_PARAM_MISSING',
      });
      return;
    }

    const mock = isMockMode();

    let resolvedSessionId = sessionId;
    let sessionData: any = null;

    if (mock) {
      sessionData = mockGetSession(sessionId || 'session_mock');
      resolvedSessionId = sessionData.id;
    } else {
      if (code) {
        console.log('[EnableBanking Accounts] Exchanging code for session...');
        sessionData = await exchangeCodeForSession(code, state || undefined);
      } else if (sessionId) {
        console.log(`[EnableBanking Accounts] Fetching session details for sessionId...`);
        sessionData = await getSession(sessionId);
      } else if (state) {
        console.log(`[EnableBanking Accounts] Checking session cache for state...`);
        sessionData = getSession(state); // getSession checks cache by key
      }
      resolvedSessionId = sessionData?.id || sessionData?.session_id || sessionId;
    }

    if (!sessionData) {
      sendJson(res, 404, {
        error: 'Bank session not found or expired. Reauthorization required.',
        code: 'BANK_REAUTH_REQUIRED',
        reauthRequired: true,
      });
      return;
    }

    const rawAccountsList: any[] = sessionData?.rawAccounts || sessionData?.accounts || [];
    console.log(`[EnableBanking Accounts] Discovered ${rawAccountsList.length} account(s) for session`);

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
