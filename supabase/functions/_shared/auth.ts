import { createClient } from '@supabase/supabase-js';
import { HttpError, requiredString } from './http.ts';
import { diagnostic } from './diagnostics.ts';

export const serviceClient = (timeoutMs?: number) => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
  ...(timeoutMs ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) }) } } : {}),
});
export type Client = ReturnType<typeof serviceClient>;
export type Asset = { id: string; assetPath: string; imageUrl: string };
export type Team = { id: string; slug: string; name: string; wordpress_api_base: string | null; wordpress_sites?: { api_base: string; purchase_urls?: Record<string,string> }[]; purchase_urls?: Record<string,string>; generation_prompt: string | null; shirts: Asset[]; backgrounds: Asset[] };
export type Actor = { team: Team; owner: string; token: string; testLinkId: string | null; balance: number };
export async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function getTeam(db: Client, slug: unknown): Promise<Team> {
  const { data, error } = await db.from('teams').select('id,slug,name,wordpress_api_base,wordpress_sites,purchase_urls,generation_prompt,shirts,backgrounds').eq('slug', requiredString(slug, 'team', 150)).eq('is_active', true).maybeSingle();
  if (error) throw new HttpError(503, 'team_unavailable');
  if (!data) throw new HttpError(404, 'team_not_found');
  return data as Team;
}
export function apiBase(team: Team) {
  if (!team.wordpress_api_base) throw new HttpError(503, 'wordpress_not_configured');
  const url = new URL(team.wordpress_api_base);
  if (url.protocol !== 'https:') throw new HttpError(503, 'invalid_wordpress_configuration');
  return url.href.replace(/\/$/, '');
}
export function wordpressSites(team: Team): Team[] {
  return [team, ...(Array.isArray(team.wordpress_sites) ? team.wordpress_sites.slice(0,3).map(site => ({...team,wordpress_api_base:site.api_base,purchase_urls:site.purchase_urls || {}})) : [])].filter(site => {
    try { const url=new URL(apiBase(site)); return !url.username && !url.password && !url.search && !url.hash; } catch { return false; }
  });
}
export function selectWordpressSite(team: Team, origin?: unknown): Team {
  const sites=wordpressSites(team);
  if (origin === undefined || origin === null || origin === '') { if (!sites[0]) throw new HttpError(503,'wordpress_not_configured'); return sites[0]; }
  if (typeof origin!=='string') throw new HttpError(400,'invalid_wordpress_origin');
  let normalized: string;
  try { const url=new URL(origin); if(url.protocol!=='https:' || url.username || url.password) throw new Error(); normalized=url.origin; } catch { throw new HttpError(400,'invalid_wordpress_origin'); }
  const selected=sites.find(site=>new URL(apiBase(site)).origin===normalized);
  if(!selected) throw new HttpError(400,'invalid_wordpress_origin');
  return selected;
}
export async function wordpressOwner(team: Team, base: string, externalId: string) {
  return base===apiBase(team) ? `wp:${externalId}` : `wp:${await hash(base)}:${externalId}`;
}
export async function wordpress(team: Team, path: string, token?: string, payload?: unknown) {
  const url = new URL(`${apiBase(team)}${path}`);
  // Some WordPress caches reuse private REST GET responses regardless of auth headers.
  if (payload === undefined) url.searchParams.set('_fanframe_nonce', crypto.randomUUID());
  const started = Date.now();
  const response = await fetch(url.href, {
    method: payload === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache', ...(token ? { 'X-Fanframe-Token': token, Authorization: `Bearer ${token}` } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }).catch(error => {
    diagnostic('error', 'wordpress_connection_failed', { stage: path.split('/').at(-1), team_id: team.id, duration_ms: Date.now()-started, error_name: error instanceof Error ? error.name : 'unknown' });
    throw error;
  });
  if (response.status === 401 || response.status === 403) throw new HttpError(401, 'session_expired');
  if (!response.ok) { diagnostic('error', 'wordpress_http_failed', { stage: path.split('/').at(-1), team_id: team.id, http_status: response.status, duration_ms: Date.now()-started }); throw new HttpError(502, 'wordpress_unavailable'); }
  const value = await response.json();
  if (!value || typeof value !== 'object' || value.ok !== true) throw new HttpError(value?.reason === 'no_credits' ? 402 : 502, value?.reason === 'no_credits' ? 'no_credits' : 'wordpress_rejected');
  return value as { ok: true; balance?: number; balance_after?: number; user_id?: number; app_token?: string; expires_at?: string };
}
export async function authenticate(db: Client, data: Record<string, unknown>): Promise<Actor> {
  const team = await getTeam(db, data.team_slug);
  if (typeof data.test_token === 'string' && data.test_token) {
    const { data: link, error } = await db.from('test_links').select('id,credits_total,credits_used,expires_at').eq('team_id', team.id).eq('token', data.test_token).eq('is_active', true).maybeSingle();
    if (error || !link || (link.expires_at && Date.parse(link.expires_at) <= Date.now())) throw new HttpError(401, 'invalid_test_link');
    return { team, owner: `test:${link.id}`, token: '', testLinkId: link.id, balance: link.credits_total - link.credits_used };
  }
  const token = requiredString(data.app_token ?? data.token, 'token');
  const { data: session, error } = await db.from('fanframe_sessions').select('external_user_id,expires_at,wordpress_api_base').eq('team_id', team.id).eq('token_hash', await hash(token)).maybeSingle();
  if (error || !session || !Number.isFinite(Date.parse(session.expires_at)) || Date.parse(session.expires_at) <= Date.now()) throw new HttpError(401, 'session_expired');
  const base=session.wordpress_api_base || apiBase(team);
  const selected=wordpressSites(team).find(site=>apiBase(site)===base);
  if(!selected) throw new HttpError(401,'session_origin_unavailable');
  return { team:selected, owner:await wordpressOwner(team,base,session.external_user_id), token, testLinkId: null, balance: 0 };
}
export async function requireAdmin(req: Request, db: Client) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'authentication_required');
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) throw new HttpError(401, 'authentication_required');
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'super_admin']);
  if (!roles?.length) throw new HttpError(403, 'admin_required');
  return user;
}
