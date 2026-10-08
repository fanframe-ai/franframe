import { serviceClient } from '../_shared/auth.ts';
import { endpoint, HttpError, json, requiredString } from '../_shared/http.ts';
import { verifyWebhook } from '../_shared/webhook.ts';

export const handler = endpoint(async req => {
  const db = serviceClient();
  const jobId = requiredString(new URL(req.url).searchParams.get('job'), 'job', 36);
  const { data: job, error } = await db.from('generation_queue').select('*').eq('id', jobId).maybeSingle();
  const raw = await req.text();
  if (error || !job?.webhook_signing_key || !await verifyWebhook(raw, req.headers, job.webhook_signing_key)) throw new HttpError(401, 'invalid_signature');
  const payload = JSON.parse(raw);
  const predictionId = requiredString(payload.id, 'prediction_id', 200);
  if (!job.replicate_prediction_id && job.status === 'processing') {
    const { error: bindError } = await db.from('generation_queue').update({ replicate_prediction_id: predictionId }).eq('id', job.id).is('replicate_prediction_id', null);
    if (bindError) throw new HttpError(503, 'prediction_pending');
  } else if (predictionId !== job.replicate_prediction_id) throw new HttpError(400, 'prediction_mismatch');
  if (['completed', 'failed', 'awaiting_payment'].includes(job.status)) return json({ received: true });
  if (payload.status === 'failed' || payload.status === 'canceled') {
    const { error: failError } = await db.rpc('fail_generation', { p_id: job.id, p_error: 'A geração falhou. Seu crédito foi preservado.' });
    if (failError) throw failError;
    return json({ received: true });
  }
  if (payload.status !== 'succeeded') return json({ received: true });
  const output = Array.isArray(payload.output) ? payload.output[0] : payload.output;
  if (typeof output !== 'string' || !output) {
    const { error: failError } = await db.rpc('fail_generation', { p_id: job.id, p_error: 'O provedor não retornou uma imagem.' });
    if (failError) throw failError;
    return json({ received: true });
  }
  const url = new URL(output);
  if (url.protocol !== 'https:' || !(url.hostname === 'replicate.delivery' || url.hostname.endsWith('.replicate.delivery'))) throw new HttpError(400, 'invalid_output');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new HttpError(502, 'output_unavailable');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 25 * 1024 * 1024) throw new HttpError(413, 'output_too_large');
  const path = `${job.team_id}/${job.id}/result.png`;
  const { error: uploadError } = await db.storage.from('tryon-temp').upload(path, bytes, { contentType: 'image/png', upsert: true });
  if (uploadError) throw uploadError;
  const { error: finishError } = await db.rpc('finish_generation', { p_id: job.id, p_path: path });
  if (finishError) throw finishError;
  return json({ received: true });
});
if (import.meta.main) Deno.serve(handler);
