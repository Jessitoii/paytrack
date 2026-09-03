import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { handleCors, sendJson } from '../_lib/cors';
import {
  exchangeCodeForSession,
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

    if (!sessionId && !code) {
      sendJson(res, 400, { error: 'Missing sessionId or code parameter.' });
      return;
    }

    const mock = isMockMode();

    let resolvedSessionId = sessionId;
    let accountIds: string[] = [];

    if (mock) {
      const mockSession = mockGetSession(sessionId || 'session_mock');
      resolvedSessionId = mockSession.id;
      accountIds = mockSession.accounts;
    } else {
      if (code && !sessionId) {
        const session = await exchangeCodeForSession(code);
        resolvedSessionId = session.id;
        accountIds = session.accounts;
      } else {
        // If sessionId is an IBAN or known account UID from session callback
        accountIds = [sessionId!];
      }
    }

    const accountsWithDetails = await Promise.all(
      accountIds.map(async (accId) => {
        try {
          const details = mock
            ? mockGetAccountDetails(accId)
            : await getAccountDetails(accId, 'ING Netherlands');

          let balances: BankAccountBalances = { balance: 0.0, availableBalance: null, currency: 'EUR' };
          try {
            balances = mock
              ? mockGetAccountBalances(accId)
              : await getAccountBalances(accId);
          } catch (balErr) {
            console.warn(`[Enable Banking] Could not fetch balances for account ${accId}:`, balErr);
          }

          return {
            id: accId,
            iban: details.iban,
            accountName: details.accountName || 'ING Betaalrekening',
            currency: details.currency || balances.currency || 'EUR',
            balance: balances.balance,
            availableBalance: balances.availableBalance,
            status: details.status || 'READY',
            bankName: details.bankName || 'ING Netherlands',
          };
        } catch (err: any) {
          console.error(`[Enable Banking Accounts] Error for account ${accId}:`, err);
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
    console.error('[Enable Banking accounts error]', err);
    sendJson(res, 500, { error: 'Failed to retrieve accounts from Enable Banking', details: err.message });
  }
}
