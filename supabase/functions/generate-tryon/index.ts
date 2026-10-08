import { authenticate, hash, serviceClient, wordpress } from '../_shared/auth.ts';
import { body, endpoint, HttpError, json, requiredString } from '../_shared/http.ts';
import { validateGeneration } from '../_shared/generation.ts';

export const handler = endpoint(async req => {
  const input = await body(req);
  const db = serviceClient();
  const actor = await authenticate(db, input);
  const request = validateGeneration(input, actor.team);
  const tokenResult = await db.from('team_secrets').select('replicate_api_token').eq('team_id', actor.team.id).maybeSingle();
  if (tokenResult.error) throw new HttpError(503, 'configuration_unavailable');
  const replicateToken = tokenResult.data?.replicate_api_token || Deno.env.get('REPLICATE_API_TOKEN');
  if (!replicateToken) throw new HttpError(503, 'generation_not_configured');
  // Reuse only an identical request owned by the authenticated subject.
  const fingerprint = await hash(JSON.stringify([request.image, request.shirt.id, request.background.id]));
  const balance = actor.testLinkId ? actor.balance : (await wordpress(actor.team, '/credits/balance', actor.token)).balance;
  if (!Number.isFinite(balance) || Number(balance) < 0) throw new HttpError(502, 'invalid_balance');
  const { data: reservation, error } = await db.rpc('reserve_generation', {
    p_id: request.id, p_team: actor.team.id, p_owner: actor.owner, p_hash: fingerprint,
    p_test_link: actor.testLinkId, p_balance: balance, p_shirt: request.shirt.id,
    p_shirt_url: request.shirt.assetPath || request.shirt.imageUrl,
    p_background_url: request.background.assetPath || request.background.imageUrl,
    p_consent: 'image_upload:v1 — Titularidade/autorização da imagem e termos aceitos.',
  });
  if (error) throw new HttpError(error.message.includes('no_credits') ? 402 : error.message.includes('rate_limit') ? 429 : 409, error.message.includes('no_credits') ? 'no_credits' : 'generation_conflict');
  if (!reservation.created) return json({ queueId: request.id, status: reservation.status, estimatedWaitSeconds: 60 });
  let predictionCreated = false;
  try {
    const secretResponse = await fetch('https://api.replicate.com/v1/webhooks/default/secret', {
      headers: { Authorization: `Bearer ${replicateToken}` }, signal: AbortSignal.timeout(15000),
    });
    if (!secretResponse.ok) throw new Error('Signing configuration unavailable');
    const secret = requiredString((await secretResponse.json()).key, 'signing_key');
    const storagePath = `${actor.team.id}/${request.id}/input.${request.extension}`;
    const { error: uploadError } = await db.storage.from('tryon-temp').upload(storagePath, request.bytes, { contentType: request.mime, upsert: false });
    if (uploadError) throw uploadError;
    const { data: signed, error: signError } = await db.storage.from('tryon-temp').createSignedUrl(storagePath, 3600);
    if (signError || !signed) throw new Error('Input unavailable');
    const { error: keyError } = await db.from('generation_queue').update({ webhook_signing_key: secret, user_image_url: storagePath, status: 'processing', started_at: new Date().toISOString() }).eq('id', request.id);
    if (keyError) throw keyError;
    // The queue ID is only a locator; the callback must still pass signature and prediction checks.
    const webhook = `${Deno.env.get('SUPABASE_URL')}/functions/v1/replicate-webhook?job=${request.id}`;
    const response = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-5-pro/predictions', {
      method: 'POST', headers: { Authorization: `Bearer ${replicateToken}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ input: { prompt: actor.team.generation_prompt || `Virtual try-on: preserve face, pose and proportions. Dress the person in the reference jersey of ${actor.team.name} and use the reference background. Photorealistic lighting and fabric.`, image_input: [signed.signedUrl, request.shirt.assetPath || request.shirt.imageUrl, request.background.assetPath || request.background.imageUrl], size: '2K', aspect_ratio: 'match_input_image', output_format: 'png' }, webhook, webhook_events_filter: ['completed'] }),
    });
    if (!response.ok) throw new Error(`Prediction rejected: ${response.status}`);
    const prediction = await response.json();
    predictionCreated = true;
    const { error: saveError } = await db.from('generation_queue').update({ replicate_prediction_id: requiredString(prediction.id, 'prediction') }).eq('id', request.id);
    // The signed callback can bind a prediction that arrives before this write.
    if (saveError) return json({ queueId: request.id, status: 'processing', estimatedWaitSeconds: 60 });
    await db.from('generations').update({ status: 'processing' }).eq('id', request.id);
    return json({ queueId: request.id, status: 'processing', estimatedWaitSeconds: 60 });
  } catch {
    if (!predictionCreated) await db.rpc('fail_generation', { p_id: request.id, p_error: 'Não foi possível iniciar a geração. Tente novamente.' });
    throw new HttpError(502, 'generation_failed');
  }
});
if (import.meta.main) Deno.serve(handler);
