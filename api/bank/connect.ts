import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { handleCors, sendJson, parseJsonBody } from '../_lib/cors';
import {
  startAuthorization,
  isMockMode,
  getEnableBankingCredentials,
} from '../_lib/enableBanking';
import { mockStartAuthorization } from '../_lib/mock';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const aspspName = body.institutionId || body.aspspName || 'ING';
    const state = body.state || crypto.randomBytes(16).toString('hex');

    const { redirectUri } = getEnableBankingCredentials();
    const redirectUrl = body.redirectUrl || redirectUri || `https://${req.headers.host}/api/bank/callback`;

    const result = isMockMode()
      ? mockStartAuthorization(aspspName, redirectUrl, state)
      : await startAuthorization(aspspName, redirectUrl, state);

    sendJson(res, 200, {
      sessionId: result.sessionId,
      requisitionId: result.sessionId, // backward compatibility
      link: result.url,
      state,
      institutionId: aspspName,
      institutionName: aspspName === 'ING' ? 'ING Netherlands' : aspspName,
    });
  } catch (err: any) {
    console.error('[Enable Banking connect error]', err);
    sendJson(res, 500, {
      error: 'Failed to initiate bank connection with Enable Banking',
      details: err.message,
    });
  }
}
