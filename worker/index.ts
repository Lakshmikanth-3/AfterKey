import { relayRequest } from '../server/cre-worker';
import assets from './assets.generated';

export default {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/cre-trigger') return relayRequest(request);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const asset = assets[path];
    if (!asset) return new Response('Not found', { status: 404 });
    const [contentType, base64] = asset;
    const headers = { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
    const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new Response(body, { headers });
  },
};
