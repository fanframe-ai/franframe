import { authenticate, serviceClient, wordpress, type Actor, type Client } from '../_shared/auth.ts';
import { body, endpoint, HttpError, json, requiredString } from '../_shared/http.ts';
import { rpc, withActorLease } from '../_shared/queue.ts';
import { diagnostic } from '../_shared/diagnostics.ts';

async function result(db: Client, actor: Actor, job: Record<string, unknown>) {
  if (job.status === 'awaiting_payment' && !actor.testLinkId) {
    // WordPress must implement its documented idempotency contract for generation_id.
    await withActorLease(db, actor, async () => {
      await wordpress(actor.team, '/credits/debit', actor.token, { generation_id: job.id });
      await rpc(db, 'confirm_generation_payment', { p_id: job.id });
      diagnostic('info', 'generation_payment_confirmed', { generation_id: job.id, team_id: actor.team.id });
    });
    job.status = 'completed';
  }
  let image: string | null = null;
  if (job.status === 'completed' && typeof job.result_storage_path === 'string') {
    const { data, error } = await db.storage.from('tryon-temp').createSignedUrl(job.result_storage_path, 300);
    if (error) { diagnostic('error', 'result_url_sign_failed', { generation_id: job.id, code: error.name }); throw error; }
    image = data.signedUrl;
  }
  const phase = job.status === 'pending' || ['uploading','ready','submitting','uncertain'].includes(String(job.work_stage)) ? 'preparing' : job.work_stage === 'output' || job.status === 'awaiting_payment' ? 'finishing' : 'generating';
  return { id: job.id, status: job.status, phase, shirt_id: job.shirt_id, created_at: job.created_at, result_image_url: image, error_message: job.error_message,
    next_poll_after: phase === 'preparing' ? (Date.now()-Date.parse(String(job.created_at)) > 120000 ? 30 : 15) : 5 };
}
export const handler = endpoint(async req => {
  const input = await body(req);
  const db = serviceClient();
  const actor = await authenticate(db, input);
  if (input.action === 'admission') {
    const capacity = await rpc<Record<string, unknown>>(db, 'generation_admission', { p_team: actor.team.id });
    return json({ ...capacity, next_poll_after: 30 });
  }
  if (input.action === 'active') {
    const { data, error } = await db.from('generation_queue').select('id,status,work_stage,shirt_id,created_at,result_storage_path,error_message').eq('team_id', actor.team.id).eq('owner_id', actor.owner).in('status', ['pending','processing','awaiting_payment']).order('created_at').limit(1).maybeSingle();
    if (error) throw new HttpError(503, 'queue_unavailable');
    return json({ generation: data ? await result(db, actor, data) : null });
  }
  if (input.action === 'history') {
    const page = typeof input.page === 'number' && Number.isSafeInteger(input.page) && input.page >= 0 && input.page <= 10000 ? input.page : 0;
    const { data, error } = await db.from('generation_queue').select('id,status,work_stage,shirt_id,created_at,result_storage_path,error_message').eq('team_id', actor.team.id).eq('owner_id', actor.owner).in('status', ['completed', 'awaiting_payment']).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 10, page * 10 + 9);
    if (error) throw error;
    const entries = [];
    for (const job of data || []) {
      try { const entry = await result(db, actor, job); if (entry.status === 'completed') entries.push(entry); }
      catch (error) { diagnostic('warning', 'history_result_pending', { generation_id: job.id, team_id: actor.team.id, error_name: error instanceof Error ? error.name : 'unknown' }); }
    }
    return json({ entries, has_more: data?.length === 10 });
  }
  const { data: job, error } = await db.from('generation_queue').select('id,status,work_stage,shirt_id,created_at,result_storage_path,error_message').eq('id', requiredString(input.queue_id, 'queue')).eq('team_id', actor.team.id).eq('owner_id', actor.owner).maybeSingle();
  if (error) throw error;
  if (!job) throw new HttpError(404, 'generation_not_found');
  return json(await result(db, actor, job));
});
if (import.meta.main) Deno.serve(handler);
