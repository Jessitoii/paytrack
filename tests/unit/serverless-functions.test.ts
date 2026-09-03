import { describe, it, expect } from 'vitest';
import healthHandler from '../../api/bank/health';
import institutionsHandler from '../../api/bank/institutions';
import connectHandler from '../../api/bank/connect';
import callbackHandler from '../../api/bank/callback';
import accountsHandler from '../../api/bank/accounts';
import syncHandler from '../../api/bank/sync';
import disconnectHandler from '../../api/bank/disconnect';
import privacyHandler from '../../api/privacy';
import termsHandler from '../../api/terms';

function createMockReqRes(options: {
  method?: string;
  url?: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  const req: any = {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || { host: 'localhost' },
    body: options.body,
    on: (event: string, callback: any) => {
      if (event === 'data' && options.body) {
        callback(JSON.stringify(options.body));
      }
      if (event === 'end') {
        callback();
      }
    },
  };

  let statusCode = 200;
  const headers: Record<string, string> = {};
  let body = '';

  const res: any = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    getHeader: (k: string) => headers[k.toLowerCase()],
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    writeHead: (code: number, hdrs?: any) => {
      statusCode = code;
      if (hdrs) {
        Object.keys(hdrs).forEach((k) => {
          headers[k.toLowerCase()] = hdrs[k];
        });
      }
    },
    end: (chunk?: string) => {
      if (chunk) body += chunk;
    },
    _getData: () => {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    },
    _getBody: () => body,
  };

  return { req, res };
}

describe('Serverless Functions API Suite (Enable Banking)', () => {
  it('GET /api/bank/health returns enable_banking provider and serverless runtime', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', url: '/api/bank/health' });
    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.status).toBe('ok');
    expect(data.provider).toBe('enable_banking');
    expect(data.runtime).toBe('serverless');
  });

  it('GET /api/bank/institutions returns Dutch institutions with ING first', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/api/bank/institutions?country=NL',
    });
    await institutionsHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.institutions.length).toBeGreaterThan(0);
    expect(data.institutions[0].name).toContain('ING');
  });

  it('POST /api/bank/connect generates authorization link for ING', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/bank/connect',
      body: {
        institutionId: 'ING',
        redirectUrl: 'https://paytrack.app/api/bank/callback',
      },
    });
    await connectHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.sessionId).toBeDefined();
    expect(data.link).toContain('https://paytrack.app/api/bank/callback');
  });

  it('GET /api/bank/callback renders HTML with deep link paytrack://', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/api/bank/callback?code=mock_code_123&state=state_abc&status=success',
    });
    await callbackHandler(req, res);

    expect(res.statusCode).toBe(200);
    const html = res._getBody();
    expect(html).toContain('paytrack://bank-callback');
    expect(html).toContain('mock_code_123');
    expect(html).toContain('status=success');
  });

  it('GET /api/bank/accounts returns authorized accounts with real account UID and balances', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/api/bank/accounts?sessionId=session_mock_default',
    });
    await accountsHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.accounts.length).toBeGreaterThan(0);
    expect(data.accounts[0].id).not.toBe('session_mock_default'); // Must NOT use sessionId as accountId!
    expect(data.accounts[0].iban).toContain('NL91INGB');
    expect(data.accounts[0].balance).toBeGreaterThan(0);
  });

  it('GET /api/bank/accounts supports code parameter exchange', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/api/bank/accounts?code=mock_code_123',
    });
    await accountsHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.accounts.length).toBeGreaterThan(0);
    expect(data.accounts[0].id).toBe('NL91INGB0001234567');
  });

  it('POST /api/bank/sync returns transaction list and balances', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/bank/sync',
      body: { accountId: 'NL91INGB0001234567' },
    });
    await syncHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.transactions.length).toBeGreaterThan(0);
    expect(data.count).toBeGreaterThan(0);
  });

  it('POST /api/bank/disconnect responds with confirmation', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/bank/disconnect',
      body: { sessionId: 'session_mock_default' },
    });
    await disconnectHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.success).toBe(true);
    expect(data.provider).toBe('enable_banking');
  });

  it('GET /privacy renders accessible privacy policy HTML', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', url: '/privacy' });
    await privacyHandler(req, res);

    expect(res.statusCode).toBe(200);
    const html = res._getBody();
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('Enable Banking');
    expect(html).toContain('PSD2');
  });

  it('GET /terms renders accessible terms of use HTML', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', url: '/terms' });
    await termsHandler(req, res);

    expect(res.statusCode).toBe(200);
    const html = res._getBody();
    expect(html).toContain('Terms of Use');
    expect(html).toContain('Enable Banking');
  });
});
