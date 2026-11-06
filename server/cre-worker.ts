import { CRE_GATEWAY } from '../src/cre/auth.js';
import { validateSignedTrigger, type TriggerPolicy } from './cre-policy.js';

async function boundedText(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!stream) return '';
  const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new Error(`Request or response exceeds ${limit} bytes.`); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

export async function relayRequest(request: Request, options: { policy?: TriggerPolicy; now?: number; forward?: typeof fetch } = {}): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') return Response.json({ error: { message: 'POST a signed request.' } }, { status: 405, headers });
  try {
    if (Number(request.headers.get('content-length')) > 16000) throw new Error('Request exceeds 16 KB.');
    const body = await boundedText(request.body, 16000), authorization = request.headers.get('authorization') || '';
    await validateSignedTrigger(body, authorization, options.now, options.policy);
    const response = await (options.forward || fetch)(CRE_GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authorization }, body, signal: AbortSignal.timeout(30000) });
    return new Response(await boundedText(response.body, 100000), { status: response.status, headers });
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : 'CRE request failed. Check execution history before retrying.' } }, { status: 400, headers });
  }
}
