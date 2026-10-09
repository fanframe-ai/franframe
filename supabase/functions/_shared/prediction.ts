import { HttpError, limitedBytes } from './http.ts';
import { diagnostic } from './diagnostics.ts';
export type Submission = { kind: 'accepted'; id: string } | { kind: 'throttled'; delay: number } | { kind: 'rejected' } | { kind: 'uncertain' };
export async function submitPrediction(token: string, payload: object, fetcher: typeof fetch = fetch): Promise<Submission> {
  try {
    const response = await fetcher('https://api.replicate.com/v1/models/bytedance/seedream-5-pro/predictions', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000), body: JSON.stringify(payload),
    });
    if (response.status === 429) {
      diagnostic('warning', 'provider_throttled', { http_status: 429 });
      const after = response.headers.get('retry-after'); const seconds = Number(after);
      const dateSeconds = after ? (Date.parse(after) - Date.now()) / 1000 : 0;
      await response.body?.cancel();
      return { kind: 'throttled', delay: Math.ceil(Math.max(5, Math.min(300, seconds || dateSeconds || 30))) };
    }
    if (!response.ok) {
      diagnostic('error', 'provider_submission_failed', { http_status: response.status });
      await response.body?.cancel();
      return { kind: response.status >= 500 || response.status === 408 ? 'uncertain' : 'rejected' };
    }
    const value = await response.json();
    return typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 200 ? { kind: 'accepted', id: value.id } : { kind: 'uncertain' };
  } catch (error) { diagnostic('error', 'provider_submission_uncertain', { error_name: error instanceof Error ? error.name : 'unknown' }); return { kind: 'uncertain' }; }
}
export function outputUrl(value: unknown): string | null {
  const output = Array.isArray(value) ? value[0] : value;
  if (output === null || output === undefined) return null;
  if (typeof output !== 'string') throw new HttpError(400, 'invalid_output');
  const url = new URL(output);
  if (url.protocol !== 'https:' || !(url.hostname === 'replicate.delivery' || url.hostname.endsWith('.replicate.delivery'))) throw new HttpError(400, 'invalid_output');
  return url.href;
}
export function matchesPredictionInput(value: unknown, path: string): boolean {
  if (!value || typeof value !== 'object') return false;
  const input = (value as { input?: { image_input?: unknown } }).input;
  const photo = Array.isArray(input?.image_input) ? input.image_input[0] : null;
  try { return typeof photo === 'string' && new URL(photo).pathname.endsWith(`/tryon-temp/${path}`); }
  catch { return false; }
}
export async function readOutput(url: string, fetcher: typeof fetch = fetch) {
  outputUrl(url);
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Output unavailable'); }
  if (Number(response.headers.get('content-length')) > 25 * 1024 * 1024) { await response.body?.cancel(); throw new HttpError(413, 'output_too_large'); }
  return await limitedBytes(response.body, 25 * 1024 * 1024);
}
