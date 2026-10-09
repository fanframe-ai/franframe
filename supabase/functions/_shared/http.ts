import { diagnostic } from './diagnostics.ts';
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Expose-Headers': 'x-fanframe-request-id',
};
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(status === 429 || status === 503 ? { 'Retry-After': '15' } : {}) } });
}
export function endpoint(handle: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const requestId = crypto.randomUUID(); const start = Date.now();
    const functionName = new URL(req.url).pathname.split('/').at(-1) || 'unknown';
    const fields = { function: functionName, request_id: requestId };
    const respond = (response: Response) => { response.headers.set('x-fanframe-request-id', requestId); return response; };
    if (req.method !== 'POST') { diagnostic('info', 'request_rejected', { ...fields, http_status: 405, code: 'method_not_allowed' }); return respond(json({ error: 'method_not_allowed', request_id: requestId }, 405)); }
    try {
      const response = await handle(req);
      if (response.status >= 500) diagnostic('error', 'request_failed', { ...fields, http_status: response.status, duration_ms: Date.now()-start });
      else if (!['generation-status','generation-worker'].includes(functionName)) diagnostic('info', 'request_completed', { ...fields, http_status: response.status, duration_ms: Date.now()-start });
      return respond(response);
    }
    catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      diagnostic(status >= 500 ? 'error' : 'info', status >= 500 ? 'request_failed' : 'request_rejected', { ...fields, http_status: status, duration_ms: Date.now()-start,
        code: error instanceof HttpError ? error.message : 'unexpected_error', error_name: error instanceof Error ? error.name : 'unknown' });
      return respond(json({ error: error instanceof HttpError ? error.message : 'Não foi possível concluir a operação.', request_id: requestId }, status));
    }
  };
}
export function requiredString(value: unknown, name: string, max = 4096): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `invalid_${name}`);
  return value;
}
export async function limitedBytes(stream: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) { await reader.cancel(); throw new HttpError(413, 'body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
export async function boundedText(req: Request, max = 64 * 1024) {
  if (Number(req.headers.get('content-length')) > max) throw new HttpError(413, 'body_too_large');
  return new TextDecoder().decode(await limitedBytes(req.body, max));
}
export async function body(req: Request, max = 64 * 1024): Promise<Record<string, unknown>> {
  const raw = await boundedText(req, max);
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new HttpError(400, 'invalid_json'); }
}
