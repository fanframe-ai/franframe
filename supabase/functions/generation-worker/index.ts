import { hash, serviceClient, type Client } from '../_shared/auth.ts';
import { endpoint, HttpError, json, requiredString } from '../_shared/http.ts';
import { rpc } from '../_shared/queue.ts';
import { matchesPredictionInput, outputUrl, readOutput, submitPrediction } from '../_shared/prediction.ts';
import { diagnostic } from '../_shared/diagnostics.ts';
type Job = { id: string; team_id: string; lease_id: string; work_stage: string; attempts: number;
  user_image_url: string; shirt_asset_url: string; background_asset_url: string;
  parameters: Record<string, unknown>; replicate_prediction_id: string | null; output_url: string | null };
const signingKeys = new Map<string, { key: string; until: number }>();
async function signingKey(token: string) {
  const fingerprint = await hash(token); const cached = signingKeys.get(fingerprint);
  if (cached && cached.until > Date.now()) return cached.key;
  const response = await fetch('https://api.replicate.com/v1/webhooks/default/secret', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Signing configuration unavailable');
  const key = requiredString((await response.json()).key, 'signing_key');
  if (signingKeys.size >= 100) signingKeys.clear();
  signingKeys.set(fingerprint, { key, until: Date.now() + 300000 });
  return key;
}
async function update(db: Client, job: Job, action: string, value?: string, delay = 60) {
  const changed = await rpc<boolean>(db, 'update_generation_work', { p_id: job.id, p_lease: job.lease_id, p_action: action, p_value: value ?? null, p_delay: delay });
  if (!changed) diagnostic('warning', 'work_lease_lost', { generation_id: job.id, stage: action });
  return changed;
}
export async function performWork(db: Client, kind: string, job: Job) {
  const started = Date.now();
  const fields = { generation_id: job.id, team_id: job.team_id, stage: kind, attempt: job.attempts };
  diagnostic('info', 'generation_work_started', fields);
  if (kind === 'persist') {
    if (!job.output_url) throw new Error('Output missing');
    const bytes = await readOutput(job.output_url);
    const path = `${job.team_id}/${job.id}/result.png`;
    const { error } = await db.storage.from('tryon-temp').upload(path, bytes, { contentType: 'image/png', upsert: true });
    if (error) throw error;
    if (await update(db, job, 'finish', path)) diagnostic('info', 'generation_result_saved', { ...fields, duration_ms: Date.now()-started }); return;
  }
  const { data, error } = await db.from('team_secrets').select('replicate_api_token').eq('team_id', job.team_id).maybeSingle();
  if (error) throw error;
  const token = data?.replicate_api_token || Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) { diagnostic('error', 'provider_not_configured', fields); if (kind === 'dispatch') await update(db, job, 'preflight_failed'); else throw new Error('Provider credential unavailable'); return; }
  if (kind === 'reconcile') {
    if (!job.replicate_prediction_id) {
      // Read-only recovery of a lost POST response. Never infer that absence permits a second POST.
      const response = await fetch('https://api.replicate.com/v1/predictions', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) { await response.body?.cancel(); throw new Error('Prediction recovery unavailable'); }
      const listing = await response.json();
      const matches = Array.isArray(listing.results) ? listing.results.slice(0, 100).filter((value: { model?: string }) => value.model === 'bytedance/seedream-5-pro' && matchesPredictionInput(value, job.user_image_url)) : [];
      if (matches.length === 1) {
        const value = matches[0];
        await rpc(db, 'record_generation_event', { p_id: job.id, p_prediction: requiredString(value.id, 'prediction_id', 200), p_status: value.status, p_output: outputUrl(value.output) });
      } else diagnostic('warning', 'prediction_uncertain', fields);
      await update(db, job, 'retry', undefined, 60); return;
    }
    const response = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(job.replicate_prediction_id)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Prediction lookup unavailable'); }
    const value = await response.json();
    if (value.id !== job.replicate_prediction_id) throw new Error('Prediction mismatch');
    await rpc(db, 'record_generation_event', { p_id: job.id, p_prediction: value.id, p_status: value.status, p_output: outputUrl(value.output) });
    await update(db, job, 'retry'); return;
  }
  let secret: string; let image: string;
  try {
    secret = await signingKey(token);
    const { data: signed, error: signError } = await db.storage.from('tryon-temp').createSignedUrl(job.user_image_url, 3600);
    if (signError || !signed) throw new Error('Input unavailable');
    image = signed.signedUrl;
    if (!await update(db, job, 'key', secret)) return;
  } catch (error) { diagnostic('error', 'generation_preflight_failed', { ...fields, error_name: error instanceof Error ? error.name : 'unknown', duration_ms: Date.now()-started }); await update(db, job, 'preflight_failed'); return; }
  const result = await submitPrediction(token, { input: { ...job.parameters, image_input: [image, job.shirt_asset_url, job.background_asset_url] },
    webhook: `${Deno.env.get('SUPABASE_URL')}/functions/v1/replicate-webhook?job=${job.id}`, webhook_events_filter: ['start','completed'] });
  diagnostic(result.kind === 'accepted' ? 'info' : 'warning', 'prediction_submission', { ...fields, code: result.kind, duration_ms: Date.now()-started });
  if (result.kind === 'accepted') await update(db, job, 'prediction', result.id);
  else if (result.kind === 'throttled') {
    await update(db, job, 'throttled', undefined, result.delay + Math.floor(Math.random() * 5));
    if (job.attempts >= 8) await rpc(db, 'fail_generation', { p_id: job.id, p_error: 'Alta demanda. Seu credito foi preservado.' });
  } else if (result.kind === 'rejected') await update(db, job, 'preflight_failed');
  else await update(db, job, 'uncertain');
}
export async function requireWorker(req: Request) {
  const expected = Deno.env.get('GENERATION_WORKER_SECRET');
  const received = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !received || await hash(received) !== await hash(expected)) throw new HttpError(401, 'worker_authentication_required');
}
export const handler = endpoint(async req => {
  await requireWorker(req);
  const db = serviceClient(); let processed = 0;
  const alertUrl = Deno.env.get('GENERATION_ALERT_WEBHOOK');
  if (alertUrl && new URL(alertUrl).protocol === 'https:') {
    const alert = await rpc<{ id: string; message: string; severity: string; created_at: string } | null>(db, 'claim_generation_alert');
    if (alert) {
      try {
        const response = await fetch(alertUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `[FanFrame] ${alert.severity}: ${alert.message}`, alert }), redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (response.ok) await db.from('system_alerts').update({ notified_at: new Date().toISOString() }).eq('id', alert.id);
        await response.body?.cancel();
        if (!response.ok) diagnostic('error', 'alert_delivery_failed', { http_status: response.status });
      } catch (error) { diagnostic('error', 'alert_delivery_failed', { error_name: error instanceof Error ? error.name : 'unknown' }); }
    }
  }
  // Bounded invocations; database leases arbitrate overlapping Cron deliveries.
  for (let batch = 0; batch < 2; batch++) {
    const claimed: { kind: string; job: Job }[] = [];
    for (let i = 0; i < 2; i++) { const work = await rpc<{ kind: string; job: Job } | null>(db, 'claim_generation_work'); if (work) claimed.push(work); }
    if (!claimed.length) break;
    await Promise.all(claimed.map(async ({ kind, job }) => {
      try { await performWork(db, kind, job); processed++; }
      catch (error) { diagnostic('error', 'generation_work_failed', { stage: kind, generation_id: job.id, team_id: job.team_id, error_name: error instanceof Error ? error.name : 'unknown' });
        await update(db, job, kind === 'dispatch' ? 'uncertain' : 'retry').catch(failure => diagnostic('error', 'generation_recovery_update_failed', { generation_id: job.id, error_name: failure instanceof Error ? failure.name : 'unknown' })); }
    }));
  }
  return json({ processed });
});
if (import.meta.main) Deno.serve(handler);
