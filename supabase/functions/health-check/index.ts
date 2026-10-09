import { requireAdmin, serviceClient, type Client } from '../_shared/auth.ts';
import { endpoint, json, limitedBytes } from '../_shared/http.ts';
import { requireWorker } from '../generation-worker/index.ts';
import { httpOutcome, overallProbeStatus, probe, type ProbeOutcome } from '../_shared/health.ts';
import { diagnostic } from '../_shared/diagnostics.ts';

async function database(db: Client): Promise<ProbeOutcome> {
  const { error } = await db.from('generations').select('id').limit(1);
  if (!error) return { status: 'operational' };
  if (error.code === '42501' || error.code === 'PGRST301') return { status: 'unknown', code: 'database_probe_not_authorized' };
  return { status: 'major_outage', code: 'database_query_failed' };
}
async function auth(db: Client): Promise<ProbeOutcome> {
  const { error } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
  return error ? httpOutcome(error.status || 503) : { status: 'operational' };
}
async function replicate(db: Client): Promise<ProbeOutcome> {
  let token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) {
    const { data, error } = await db.from('team_secrets').select('replicate_api_token,teams!inner(is_active)').eq('teams.is_active', true).not('replicate_api_token', 'is', null).limit(1).maybeSingle();
    if (error) return { status: 'unknown', code: 'credential_lookup_failed' };
    token = data?.replicate_api_token;
  }
  if (!token) return { status: 'unknown', code: 'provider_not_configured' };
  const response = await fetch('https://api.replicate.com/v1/account', { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(8000) });
  const outcome = httpOutcome(response.status); await response.body?.cancel(); return outcome;
}
export async function edge(): Promise<ProbeOutcome> {
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return { status: 'unknown', code: 'edge_probe_not_configured' };
  const response = await fetch(`${url}/functions/v1/generation-status`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) });
  if (response.status !== 400) { const outcome = httpOutcome(response.status); await response.body?.cancel(); return outcome.status === 'operational' ? { status: 'unknown', code: 'unexpected_handler_response' } : outcome; }
  try {
    const raw = new TextDecoder().decode(await limitedBytes(response.body, 4096)); const value = JSON.parse(raw);
    return value?.error === 'invalid_team' ? { status: 'operational' } : { status: 'unknown', code: 'unexpected_handler_response' };
  } catch { return { status: 'unknown', code: 'unexpected_handler_response' }; }
}
async function realtime(): Promise<ProbeOutcome> {
  const base = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!base || !key) return { status: 'unknown', code: 'realtime_not_configured' };
  const url = new URL(`${base.replace(/^http/, 'ws')}/realtime/v1/websocket`); url.searchParams.set('apikey', key); url.searchParams.set('vsn', '1.0.0');
  const socket = new WebSocket(url);
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (ok: boolean) => { clearTimeout(timeout); socket.onopen = null; socket.onerror = null; socket.onclose = null; if (ok) resolve(); else reject(new Error('realtime_probe_failed')); };
      const timeout = setTimeout(() => finish(false), 8000);
      socket.onopen = () => finish(true); socket.onerror = () => finish(false); socket.onclose = () => finish(false);
    });
    return { status: 'operational' };
  } finally { socket.close(); }
}
async function cdn(db: Client): Promise<ProbeOutcome> {
  const { data, error } = await db.from('teams').select('shirts').eq('is_active', true).limit(1).maybeSingle();
  if (error) return { status: 'unknown', code: 'asset_lookup_failed' };
  const asset = data?.shirts?.find((item: { assetPath?: string; imageUrl?: string }) => item.assetPath || item.imageUrl); const url = asset?.assetPath || asset?.imageUrl;
  try { if (!url || new URL(url).protocol !== 'https:') return { status: 'unknown', code: 'asset_not_configured' }; }
  catch { return { status: 'unknown', code: 'asset_not_configured' }; }
  let response = await fetch(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (response.status === 405) { await response.body?.cancel(); response = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'error', signal: AbortSignal.timeout(8000) }); }
  const contentType = response.headers.get('content-type'); const outcome = httpOutcome(response.status); await response.body?.cancel();
  if (response.status === 404) return { status: 'degraded', code: 'reference_asset_missing' };
  if (outcome.status === 'operational' && !contentType?.startsWith('image/')) return { status: 'unknown', code: 'unexpected_asset_response' };
  return outcome;
}
export const handler = endpoint(async req => {
  const db = serviceClient(8000);
  try { await requireWorker(req); } catch { await requireAdmin(req, db); }
  const start = Date.now(); const runId = crypto.randomUUID(); const checkedAt = new Date().toISOString();
  const results = await Promise.all([
    probe('database', 'Banco de Dados', () => database(db)), probe('auth', 'Autenticacao', () => auth(db)),
    probe('replicate', 'API IA (Replicate)', () => replicate(db)), probe('edge-functions', 'Funcoes de Backend', edge),
    probe('realtime', 'Tempo Real', realtime), probe('cdn', 'CDN / Assets', () => cdn(db)),
  ]);
  const { error } = await db.from('health_checks').insert(results.map(result => ({ service_id: result.service_id, service_name: result.service_name,
    status: result.status, response_time_ms: result.response_time_ms, error_message: result.error_message || null, probe_version: 2, run_id: runId, created_at: checkedAt })));
  if (error) diagnostic('error', 'health_persistence_failed', { function: 'health-check', code: error.code, request_id: runId });
  return json({ success: !error, persisted: !error, overall_status: overallProbeStatus(results.map(result => result.status)), results,
    check_duration_ms: Date.now() - start, checked_at: checkedAt, run_id: runId, ...(error ? { error: 'health_persistence_failed' } : {}) }, error ? 503 : 200);
});
if (import.meta.main) Deno.serve(handler);
