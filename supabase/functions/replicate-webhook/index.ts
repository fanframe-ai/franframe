import { serviceClient } from '../_shared/auth.ts';
import { boundedText, endpoint, HttpError, json, requiredString } from '../_shared/http.ts';
import { verifyWebhook } from '../_shared/webhook.ts';
import { matchesPredictionInput, outputUrl } from '../_shared/prediction.ts';
import { rpc } from '../_shared/queue.ts';
export const handler = endpoint(async req => {
  const db = serviceClient(); const jobId = requiredString(new URL(req.url).searchParams.get('job'), 'job', 36);
  const { data: job, error } = await db.from('generation_queue').select('id,status,user_image_url,webhook_signing_key,replicate_prediction_id').eq('id', jobId).maybeSingle();
  const raw = await boundedText(req, 256 * 1024);
  if (error || !job?.webhook_signing_key || !await verifyWebhook(raw, req.headers, job.webhook_signing_key)) throw new HttpError(401, 'invalid_signature');
  const payload = JSON.parse(raw); const predictionId = requiredString(payload.id, 'prediction_id', 200);
  if (job.replicate_prediction_id && predictionId !== job.replicate_prediction_id) throw new HttpError(400, 'prediction_mismatch');
  if (!job.replicate_prediction_id) {
    if (!matchesPredictionInput(payload, job.user_image_url)) throw new HttpError(400, 'prediction_input_mismatch');
  }
  if (['completed','failed','awaiting_payment'].includes(job.status)) return json({ received: true });
  await rpc(db, 'record_generation_event', { p_id: job.id, p_prediction: predictionId, p_status: payload.status, p_output: outputUrl(payload.output) });
  return json({ received: true });
});
if (import.meta.main) Deno.serve(handler);
