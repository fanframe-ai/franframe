import { authenticate, serviceClient, wordpress, type Actor, type Client } from '../_shared/auth.ts';
import { body, endpoint, HttpError, json, requiredString } from '../_shared/http.ts';

async function result(db: Client, actor: Actor, job: Record<string, unknown>) {
  if (job.status === 'awaiting_payment' && !actor.testLinkId) {
    // WordPress must implement its documented idempotency contract for generation_id.
    await wordpress(actor.team, '/credits/debit', actor.token, { generation_id: job.id });
    const { error } = await db.rpc('confirm_generation_payment', { p_id: job.id });
    if (error) throw error;
    job.status = 'completed';
  }
  let image: string | null = null;
  if (job.status === 'completed' && typeof job.result_storage_path === 'string') {
    const { data, error } = await db.storage.from('tryon-temp').createSignedUrl(job.result_storage_path, 300);
    if (error) throw error;
    image = data.signedUrl;
  }
  return { id: job.id, status: job.status, shirt_id: job.shirt_id, created_at: job.created_at, result_image_url: image, error_message: job.error_message };
}
export const handler = endpoint(async req => {
  const input = await body(req);
  const db = serviceClient();
  const actor = await authenticate(db, input);
  if (input.action === 'history') {
    const { data, error } = await db.from('generation_queue').select('id,status,shirt_id,created_at,result_storage_path,error_message').eq('team_id', actor.team.id).eq('owner_id', actor.owner).in('status', ['completed', 'awaiting_payment']).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    const entries = await Promise.allSettled((data || []).map(job => result(db, actor, job)));
    return json({ entries: entries.flatMap(item => item.status === 'fulfilled' && item.value.status === 'completed' ? [item.value] : []) });
  }
  const { data: job, error } = await db.from('generation_queue').select('id,status,shirt_id,created_at,result_storage_path,error_message').eq('id', requiredString(input.queue_id, 'queue')).eq('team_id', actor.team.id).eq('owner_id', actor.owner).maybeSingle();
  if (error) throw error;
  if (!job) throw new HttpError(404, 'generation_not_found');
  return json(await result(db, actor, job));
});
if (import.meta.main) Deno.serve(handler);
