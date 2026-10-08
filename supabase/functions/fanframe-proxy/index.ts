import { authenticate, getTeam, hash, serviceClient, wordpress } from '../_shared/auth.ts';
import { body, endpoint, HttpError, json, requiredString } from '../_shared/http.ts';

export const handler = endpoint(async req => {
  const input = await body(req);
  const db = serviceClient();
  if (input.action === 'exchange') {
    const team = await getTeam(db, input.team_slug);
    const code = requiredString((input.body as Record<string, unknown>)?.code, 'code', 1024);
    const exchange = await wordpress(team, '/handoff/exchange', undefined, { code });
    const token = requiredString(exchange.app_token, 'app_token');
    if (typeof exchange.user_id !== 'number' || !Number.isSafeInteger(exchange.user_id)) throw new HttpError(502, 'invalid_user_id');
    const externalId = String(exchange.user_id);
    const expires = exchange.expires_at ? new Date(exchange.expires_at) : new Date(Date.now() + 60 * 60 * 1000);
    if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) throw new HttpError(502, 'invalid_expiration');
    const { error } = await db.from('fanframe_sessions').upsert({ team_id: team.id, external_user_id: externalId, token_hash: await hash(token), expires_at: expires.toISOString() }, { onConflict: 'team_id,token_hash' });
    if (error) throw error;
    return json(exchange);
  }
  const actor = await authenticate(db, input);
  if (input.action === 'balance') {
    if (actor.testLinkId) return json({ ok: true, balance: actor.balance });
    return json(await wordpress(actor.team, '/credits/balance', actor.token));
  }
  if (input.action === 'test') return json({ ok: true, balance: actor.balance });
  if (input.action === 'consent') {
    const { error } = await db.from('consent_logs').insert({
      team_id: actor.team.id,
      user_id: actor.owner,
      consent_text: 'image_upload:v1 — Titularidade/autorização da imagem e termos aceitos.',
      user_agent: req.headers.get('user-agent')?.slice(0, 500) || null,
    });
    if (error) throw error;
    return json({ ok: true });
  }
  throw new HttpError(403, 'action_not_allowed');
});
if (import.meta.main) Deno.serve(handler);
