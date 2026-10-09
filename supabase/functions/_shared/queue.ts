import { type Actor, type Client } from './auth.ts';
import { HttpError } from './http.ts';
import { diagnostic } from './diagnostics.ts';
export async function rpc<T>(db: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    const code = ['no_credits','generation_active','queue_full','budget_exhausted','admissions_paused','rate_limit_exceeded','idempotency_conflict'].find(value => error.message.includes(value));
    if (code) throw new HttpError(code === 'no_credits' ? 402 : code === 'idempotency_conflict' ? 409 : 429, code);
    diagnostic('error', 'database_rpc_failed', { rpc: name, code: error.code, generation_id: args.p_id, team_id: args.p_team });
    throw new HttpError(503, 'queue_unavailable');
  }
  return data as T;
}
export async function withActorLease<T>(db: Client, actor: Actor, work: () => Promise<T>): Promise<T> {
  const args = { p_team: actor.team.id, p_owner: actor.owner, p_lease: crypto.randomUUID() };
  if (!await rpc<boolean>(db, 'acquire_generation_actor', args)) throw new HttpError(429, 'account_busy');
  try { return await work(); }
  finally { await rpc(db, 'release_generation_actor', args); }
}
