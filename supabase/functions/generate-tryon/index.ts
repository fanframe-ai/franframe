import { authenticate, hash, serviceClient, wordpress } from '../_shared/auth.ts';
import { body, endpoint, HttpError, json } from '../_shared/http.ts';
import { validateGeneration } from '../_shared/generation.ts';
import { rpc, withActorLease } from '../_shared/queue.ts';
export const handler = endpoint(async req => {
  const input = await body(req, 16 * 1024 * 1024);
  const db = serviceClient(); const actor = await authenticate(db, input);
  const request = validateGeneration(input, actor.team);
  const fingerprint = await hash(JSON.stringify([request.image, request.shirt.id, request.background.id]));
  return await withActorLease(db, actor, async () => {
    const { data: existing, error: lookupError } = await db.from('generation_queue').select('id,status,team_id,owner_id,request_hash').eq('id', request.id).maybeSingle();
    if (lookupError) throw new HttpError(503, 'queue_unavailable');
    if (existing) {
      if (existing.team_id !== actor.team.id || existing.owner_id !== actor.owner || existing.request_hash !== fingerprint) throw new HttpError(409, 'idempotency_conflict');
      return json({ queueId: existing.id, status: existing.status, next_poll_after: 10 });
    }
    const { data: active, error: activeError } = await db.from('generation_queue').select('id,status').eq('team_id', actor.team.id).eq('owner_id', actor.owner).in('status', ['pending','processing','awaiting_payment']).limit(1).maybeSingle();
    if (activeError) throw new HttpError(503, 'queue_unavailable');
    if (active) return json({ queueId: active.id, status: active.status, next_poll_after: 10 });
    const balance = actor.testLinkId ? actor.balance : (await wordpress(actor.team, '/credits/balance', actor.token)).balance;
    if (!Number.isFinite(balance) || Number(balance) < 0) throw new HttpError(502, 'invalid_balance');
    await rpc(db, 'reserve_generation', {
      p_id: request.id, p_team: actor.team.id, p_owner: actor.owner, p_hash: fingerprint,
      p_test_link: actor.testLinkId, p_balance: balance, p_shirt: request.shirt.id,
      p_shirt_url: request.shirt.assetPath || request.shirt.imageUrl,
      p_background_url: request.background.assetPath || request.background.imageUrl,
      p_consent: 'image_upload:v1 — Titularidade/autorização da imagem e termos aceitos.',
    });
    try {
      const path = `${actor.team.id}/${request.id}/input.${request.extension}`;
      const { error } = await db.storage.from('tryon-temp').upload(path, request.bytes, { contentType: request.mime, upsert: false });
      if (error) throw error;
      if (!await rpc<boolean>(db, 'mark_generation_ready', { p_id: request.id, p_path: path, p_parameters: {
        prompt: actor.team.generation_prompt || `Virtual try-on: preserve face, pose and proportions. Dress the person in the reference jersey of ${actor.team.name} and use the reference background. Photorealistic lighting and fabric.`,
        size: '2K', aspect_ratio: 'match_input_image', output_format: 'png',
      } })) throw new Error('Upload reservation expired');
    } catch {
      await rpc(db, 'fail_generation', { p_id: request.id, p_error: 'Nao foi possivel enviar a foto. Seu credito foi preservado.' });
      throw new HttpError(503, 'upload_failed');
    }
    return json({ queueId: request.id, status: 'pending', next_poll_after: 10 }, 202);
  });
});
if (import.meta.main) Deno.serve(handler);
