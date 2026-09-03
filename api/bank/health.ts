import type { IncomingMessage, ServerResponse } from 'http';
import { handleCors, sendJson } from '../_lib/cors';
import { isMockMode } from '../_lib/enableBanking';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  sendJson(res, 200, {
    status: 'ok',
    provider: 'enable_banking',
    runtime: 'serverless',
    mode: isMockMode() ? 'mock' : 'live',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
}
