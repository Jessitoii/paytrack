import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { handleCors, sendJson } from '../_lib/cors';
import { getInstitutions, isMockMode } from '../_lib/enableBanking';
import { mockGetInstitutions } from '../_lib/mock';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  try {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const country = parsedUrl.searchParams.get('country') || 'NL';

    const institutions = isMockMode()
      ? mockGetInstitutions()
      : await getInstitutions(country);

    sendJson(res, 200, {
      provider: 'enable_banking',
      institutions,
    });
  } catch (err: any) {
    console.error('[Enable Banking institutions error]', err);
    sendJson(res, 500, { error: 'Failed to retrieve institutions list', details: err.message });
  }
}
