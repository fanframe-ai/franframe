import { wordpress, selectWordpressSite, wordpressOwner, authenticate, type Client, type Team } from '../functions/_shared/auth.ts';
import { HttpError } from '../functions/_shared/http.ts';

const team: Team = { id: 'team1', slug: 'team1', name: 'Team', wordpress_api_base: 'https://wordpress.example/wp-json/vf-fanframe/v1', generation_prompt: null, shirts: [], backgrounds: [] };
function check(value: unknown, message: string) { if (!value) throw new Error(message); }

Deno.test('same team WordPress sources are allowlisted, session-pinned and ownership-isolated', async()=>{
  const dual={...team,wordpress_sites:[{api_base:'https://production.example/wp-json/vf-fanframe/v1',purchase_urls:{credits1:'https://production.example/checkout/'}}]};
  const production=selectWordpressSite(dual,'https://production.example');
  check(production.wordpress_api_base===dual.wordpress_sites[0].api_base,'Select only configured source');
  check(selectWordpressSite(dual).wordpress_api_base===team.wordpress_api_base,'Legacy handoffs retain primary');
  for(const origin of ['https://unknown.example','http://production.example','https://user:password@production.example']) {
    let rejected=false;try{selectWordpressSite(dual,origin);}catch(error){rejected=error instanceof HttpError && error.status===400;}check(rejected,'Reject unconfigured origins');
  }
  check(await wordpressOwner(dual,team.wordpress_api_base!,'42')==='wp:42','Preserve primary historical owner');
  const owner=await wordpressOwner(dual,production.wordpress_api_base!,'42');
  check(owner!== 'wp:42' && owner.startsWith('wp:'),'Same user ID in production must be isolated');
  const db={from:(table:string)=>{const query={select:()=>query,eq:()=>query,maybeSingle:()=>Promise.resolve({data:table==='teams'?dual:{external_user_id:'42',expires_at:new Date(Date.now()+60000).toISOString(),wordpress_api_base:production.wordpress_api_base},error:null})};return query;}} as unknown as Client;
  const actor=await authenticate(db,{team_slug:team.slug,app_token:'fixture',wordpress_origin:'https://wordpress.example'});
  check(actor.owner===owner && actor.team.wordpress_api_base===production.wordpress_api_base,'Client cannot change origin of validated session');
  const original=globalThis.fetch;
  globalThis.fetch=(input)=>{check(String(input).startsWith('https://production.example/'),'Credits and debit stay on authenticated source');return Promise.resolve(new Response('{"ok":true,"balance":3,"balance_after":2}'));};
  try{await wordpress(actor.team,'/credits/balance',actor.token);await wordpress(actor.team,'/credits/debit',actor.token,{generation_id:'fixture-id'});}finally{globalThis.fetch=original;}
});

Deno.test('WordPress balance bypasses stale shared GET cache and keeps users isolated', async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (input, init) => {
    const url = new URL(String(input));
    urls.push(url.href);
    const headers = new Headers(init?.headers);
    const fresh = url.searchParams.has('_fanframe_nonce');
    const balance = fresh ? headers.get('authorization') === 'Bearer fixture-a' ? 4 : 9 : 5;
    if (fresh) {
      check(init?.cache === 'no-store', 'Fetch must not reuse cached balances');
      check(headers.get('cache-control')?.includes('no-cache'), 'Tell upstream caches to revalidate');
      check(headers.get('x-fanframe-token') !== null, 'Authentication headers must be retained');
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true, balance }), { headers: { 'Content-Type': 'application/json' } }));
  };
  try {
    const a = await wordpress(team, '/credits/balance', 'fixture-a');
    check(a.balance === 4, `Expected fresh balance 4, received ${a.balance}`);
    const b = await wordpress(team, '/credits/balance', 'fixture-b');
    check(b.balance === 9, 'Different users must not share a cached balance');
    await wordpress(team, '/credits/balance', 'fixture-a');
    check(new Set(urls).size === 3, 'Every balance request must have a unique cache key');
    check(!urls.some(url => url.includes('fixture-')), 'Tokens must never appear in URLs');
  } finally { globalThis.fetch = original; }
});

Deno.test('WordPress uncached unauthorized balance remains rejected', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response('{}', { status: 401 }));
  try {
    let rejected = false;
    try { await wordpress(team, '/credits/balance', 'expired-fixture'); }
    catch (error) { rejected = error instanceof HttpError && error.status === 401; }
    check(rejected, 'Invalid sessions must not receive a balance');
  } finally { globalThis.fetch = original; }
});

Deno.test('WordPress debit retains POST body and generation idempotency key', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(String(input));
    check(url.pathname.endsWith('/credits/debit'), 'Keep the debit endpoint');
    check(!url.searchParams.has('_fanframe_nonce'), 'Do not change POST identifiers');
    check(init?.method === 'POST', 'Debit must remain POST');
    check(JSON.parse(String(init?.body)).generation_id === 'fixture-generation', 'Keep the idempotency key');
    return Promise.resolve(new Response('{"ok":true,"balance_after":4}'));
  };
  try { await wordpress(team, '/credits/debit', 'fixture-a', { generation_id: 'fixture-generation' }); }
  finally { globalThis.fetch = original; }
});
