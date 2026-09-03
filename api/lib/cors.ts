import type { IncomingMessage, ServerResponse } from 'http';

export function handleCors(req: IncomingMessage, res: ServerResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

export function sendHtml(res: ServerResponse, statusCode: number, html: string): void {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode = statusCode;
  res.end(html);
}

export async function parseJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  // If already parsed by serverless platform (e.g. Vercel / Next)
  if ((req as any).body && typeof (req as any).body === 'object') {
    return (req as any).body as T;
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(body) as T);
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}
