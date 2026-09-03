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
    let state = body.state;
    if (!state) {
      const stateObj = {
        id: crypto.randomBytes(12).toString('hex'),
        appRedirectUrl: body.appRedirectUrl || 'paytrack://bank-callback',
      };
      state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');
    }

    const { redirectUri } = getEnableBankingCredentials();
    const redirectUrl = body.redirectUrl || redirectUri || `https://${req.headers.host}/api/bank/callback`;

    console.log(`[EnableBanking Connect] Initiating auth flow: aspsp=${aspspName}, redirectUrl=${redirectUrl}`);

    const result = isMockMode()
      ? mockStartAuthorization(aspspName, redirectUrl, state)
      : await startAuthorization(aspspName, redirectUrl, state);

    console.log(`[EnableBanking Connect] Auth flow initialized successfully: authFlowId=${result.authFlowId || 'none'}`);

    sendJson(res, 200, {
      authFlowId: result.authFlowId || null,
      link: result.url,
      state,
      institutionId: aspspName,
      institutionName: aspspName === 'ING' ? 'ING Netherlands' : aspspName,
    });
  } catch (err: any) {
    const cleanError = err?.message || 'Internal error';
    console.error(`[EnableBanking Connect Error] status=500, message=${cleanError}`);
    sendJson(res, 500, {
      error: 'Failed to initiate bank connection with Enable Banking',
      details: cleanError,
    });
  }
}
