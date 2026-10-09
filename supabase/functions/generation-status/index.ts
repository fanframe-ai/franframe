import { authenticate, serviceClient, wordpress, type Actor, type Client } from '../_shared/auth.ts';
import { body, endpoint, HttpError, json, requiredString } from '../_shared/http.ts';
import { rpc, withActorLease } from '../_shared/queue.ts';

async function result(db: Client, actor: Actor, job: Record<string, unknown>) {
  if (job.status === 'awaiting_payment' && !actor.testLinkId) {
    // WordPress must implement its documented idempotency contract for generation_id.
    await withActorLease(db, actor, async () => {
      await wordpress(actor.team, '/credits/debit', actor.token, { generation_id: job.id });
      await rpc(db, 'confirm_generation_payment', { p_id: job.id });
    });
    job.status = 'completed';
  }
  let image: string | null = null;
  if (job.status === 'completed' && typeof job.result_storage_path === 'string') {
    const { data, error } = await db.storage.from('tryon-temp').createSignedUrl(job.result_storage_path, 300);
    if (error) throw error;
    image = data.signedUrl;
  }
  return { id: job.id, status: job.status, shirt_id: job.shirt_id, created_at: job.created_at, result_image_url: image, error_message: job.error_message, next_poll_after: job.status === 'pending' ? 10 : 5 };
}
export const handler = endpoint(async req => {
  const input = await body(req);
  const db = serviceClient();
  const actor = await authenticate(db, input);
  if (input.action === 'active') {
    const { data, error } = await db.from('generation_queue').select('id,status,shirt_id,created_at,result_storage_path,error_message').eq('team_id', actor.team.id).eq('owner_id', actor.owner).in('status', ['pending','processing','awaiting_payment']).order('created_at').limit(1).maybeSingle();
    if (error) throw new HttpError(503, 'queue_unavailable');
    return json({ generation: data ? await result(db, actor, data) : null });
  }
  if (input.action === 'history') {
    const page = typeof input.page === 'number' && Number.isSafeInteger(input.page) && input.page >= 0 && input.page <= 10000 ? input.page : 0;
    const { data, error } = await db.from('generation_queue').select('id,status,shirt_id,created_at,result_storage_path,error_message').eq('team_id', actor.team.id).eq('owner_id', actor.owner).in('status', ['completed', 'awaiting_payment']).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 10, page * 10 + 9);
    if (error) throw error;
    const entries = [];
    for (const job of data || []) {
      try { const entry = await result(db, actor, job); if (entry.status === 'completed') entries.push(entry); }
      catch { /* Keep unavailable entries private and recover on the next refresh. */ }
    }
    return json({ entries, has_more: data?.length === 10 });
  }
  const { data: job, error } = await db.from('generation_queue').select('id,status,shirt_id,created_at,result_storage_path,error_message').eq('id', requiredString(input.queue_id, 'queue')).eq('team_id', actor.team.id).eq('owner_id', actor.owner).maybeSingle();
  if (error) throw error;
  if (!job) throw new HttpError(404, 'generation_not_found');
  return json(await result(db, actor, job));
});
if (import.meta.main) Deno.serve(handler);
