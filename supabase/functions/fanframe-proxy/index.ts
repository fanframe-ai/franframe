import { authenticate, getTeam, hash, serviceClient, wordpress, selectWordpressSite, apiBase } from '../_shared/auth.ts';
import { rpc } from '../_shared/queue.ts';
import { body, endpoint, HttpError, json, requiredString } from '../_shared/http.ts';

export const handler = endpoint(async req => {
  const input = await body(req);
  const db = serviceClient();
  if (input.action === 'exchange') {
    const team = selectWordpressSite(await getTeam(db, input.team_slug), input.wordpress_origin);
    const code = requiredString((input.body as Record<string, unknown>)?.code, 'code', 1024);
    const exchange = await wordpress(team, '/handoff/exchange', undefined, { code });
    const token = requiredString(exchange.app_token, 'app_token');
    if (typeof exchange.user_id !== 'number' || !Number.isSafeInteger(exchange.user_id)) throw new HttpError(502, 'invalid_user_id');
    const externalId = String(exchange.user_id);
    const expires = exchange.expires_at ? new Date(exchange.expires_at) : new Date(Date.now() + 60 * 60 * 1000);
    if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) throw new HttpError(502, 'invalid_expiration');
    if(!await rpc<boolean>(db,'bind_fanframe_session',{p_team:team.id,p_external:externalId,p_hash:await hash(token),p_expires:expires.toISOString(),p_base:apiBase(team)})) throw new HttpError(409,'session_origin_conflict');
    return json({...exchange,wordpress_origin:new URL(apiBase(team)).origin,purchase_urls:team.purchase_urls || {}});
  }
  const actor = await authenticate(db, input);
  if (input.action === 'balance') {
    if (actor.testLinkId) return json({ ok: true, balance: actor.balance });
    return json({...await wordpress(actor.team, '/credits/balance', actor.token),wordpress_origin:new URL(apiBase(actor.team)).origin,purchase_urls:actor.team.purchase_urls || {}});
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
