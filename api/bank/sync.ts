import type { IncomingMessage, ServerResponse } from 'http';
import { handleCors, sendJson, parseJsonBody } from '../_lib/cors';
import {
  getAccountTransactions,
  getAccountBalances,
  isMockMode,
} from '../_lib/enableBanking';
import {
  mockGetAccountTransactions,
  mockGetAccountBalances,
} from '../_lib/mock';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const accountId = body.accountId;
    const dateFrom = body.dateFrom;

    if (!accountId) {
      sendJson(res, 400, { error: 'Missing accountId in request body.' });
      return;
    }

    const mock = isMockMode();
    const transactions = mock
      ? mockGetAccountTransactions(accountId)
      : await getAccountTransactions(accountId, dateFrom);

    let balances = null;
    try {
      balances = mock
        ? mockGetAccountBalances(accountId)
        : await getAccountBalances(accountId);
    } catch (_) {}

    sendJson(res, 200, {
      accountId,
      balances,
      transactions,
      count: transactions.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    const is404 =
      err?.statusCode === 404 ||
      err?.code === 'BANK_SESSION_NOT_FOUND' ||
      err?.message?.includes('404') ||
      err?.message?.includes('No account found');

    console.error('[Enable Banking sync error]', err?.message);
    sendJson(res, is404 ? 404 : 500, {
      error: is404
        ? 'Bank account or authorization session not found or expired. Reauthorization required.'
        : 'Failed to sync bank transactions via Enable Banking',
      code: is404 ? 'BANK_REAUTH_REQUIRED' : 'BANK_SYNC_FAILED',
      reauthRequired: is404,
      details: err?.message,
    });
  }
}
