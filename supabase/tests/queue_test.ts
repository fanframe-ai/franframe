import { submitPrediction, outputUrl, readOutput } from '../functions/_shared/prediction.ts';
import { boundedText } from '../functions/_shared/http.ts';
import { handler as worker, requireWorker, performWork } from '../functions/generation-worker/index.ts';
import type { Client } from '../functions/_shared/auth.ts';
function equal(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); }
async function rejects(work: () => unknown | Promise<unknown>) { try { await work(); } catch { return; } throw new Error('Expected rejection'); }
Deno.test('prediction timeout, malformed response and 5xx retain an uncertain submission', async () => {
  for (const fetcher of [async () => { throw new Error('Connection lost after acceptance'); }, async () => new Response('{}'), async () => new Response('{"id":""}'), async () => new Response('timeout', { status: 408 }), async () => new Response('failed', { status: 503 })]) {
    let calls = 0;
    equal(await submitPrediction('fixture', {}, (() => { calls++; return fetcher(); }) as typeof fetch), { kind: 'uncertain' });
    equal(calls, 1);
  }
});
Deno.test('leased worker dispatches once, reconciles a lost response by input UUID and persists privately', async () => {
  const originalFetch = globalThis.fetch;
  const mutations: { name: string; args: Record<string, unknown> }[] = [];
  const uploads: { bucket: string; path: string; bytes: number }[] = [];
  const job = { id:'job-fixture',team_id:'team-fixture',lease_id:'lease-fixture',work_stage:'submitting',attempts:1,user_image_url:'team-fixture/job-fixture/input.png',shirt_asset_url:'https://assets.test/shirt.png',background_asset_url:'https://assets.test/background.png',parameters:{size:'2K',output_format:'png',prompt:'preserve identity'},replicate_prediction_id:null,output_url:null };
  const inputUrl = `https://storage.test/storage/v1/object/sign/tryon-temp/${job.user_image_url}?token=fixture`;
  const db = {
    rpc: async (name: string, args: Record<string,unknown>) => { mutations.push({name,args}); return {data:true,error:null}; },
    from: () => ({select:()=>({eq:()=>({maybeSingle:async()=>({data:{replicate_api_token:'worker-flow-fixture'},error:null})})})}),
    storage:{from:(bucket:string)=>({createSignedUrl:async()=>({data:{signedUrl:inputUrl},error:null}),upload:async(path:string,bytes:Uint8Array)=>{uploads.push({bucket,path,bytes:bytes.length});return {error:null};}})},
  } as unknown as Client;
  let posts = 0;
  try {
    globalThis.fetch = (async (url, init) => {
      const target=String(url);
      if(target.endsWith('/webhooks/default/secret')) return Response.json({key:'whsec_fixture'});
      if(init?.method==='POST') { posts++; const payload=JSON.parse(String(init.body)); equal(payload.input.size,'2K');equal(payload.input.image_input[0],inputUrl);return Response.json({id:'provider-fixture'}); }
      if(target.endsWith('/predictions')) return Response.json({results:[{id:'provider-fixture',model:'bytedance/seedream-5-pro',status:'succeeded',input:{image_input:[inputUrl]},output:['https://replicate.delivery/result.png']},{id:'wrong',model:'bytedance/seedream-5-pro',input:{image_input:['https://storage.test/another.png']}}]});
      if(target==='https://replicate.delivery/result.png') return new Response(new Uint8Array([1,2,3]));
      throw new Error('Unexpected provider request');
    }) as typeof fetch;
    await performWork(db,'dispatch',job);
    equal(posts,1); equal(mutations.map(x=>x.args.p_action),['key','prediction']);
    await performWork(db,'reconcile',{...job,work_stage:'uncertain'});
    equal(posts,1);const event=mutations.find(x=>x.name==='record_generation_event');equal(event?.args.p_prediction,'provider-fixture');equal(event?.args.p_status,'succeeded');
    await performWork(db,'persist',{...job,work_stage:'output',output_url:'https://replicate.delivery/result.png'});
    equal(uploads,[{bucket:'tryon-temp',path:'team-fixture/job-fixture/result.png',bytes:3}]);equal(mutations.at(-1)?.args.p_action,'finish');
  } finally { globalThis.fetch=originalFetch; }
});
Deno.test('only explicit throttle permits delayed submission retry', async () => {
  equal(await submitPrediction('fixture', {}, (async () => new Response('{}', { status: 429, headers: { 'retry-after': '45' } })) as typeof fetch), { kind: 'throttled', delay: 45 });
  equal(await submitPrediction('fixture', {}, (async () => new Response('{}', { status: 401 })) as typeof fetch), { kind: 'rejected' });
  equal(await submitPrediction('fixture', {}, (async () => new Response('{"id":"prediction-1"}')) as typeof fetch), { kind: 'accepted', id: 'prediction-1' });
});
Deno.test('worker denies public and missing credentials before any database access', async () => {
  const original = Deno.env.get('GENERATION_WORKER_SECRET');
  try {
    Deno.env.set('GENERATION_WORKER_SECRET', 'private-fixture');
    equal((await worker(new Request('https://local/worker', { method: 'POST' }))).status, 401);
    equal((await worker(new Request('https://local/worker', { method: 'POST', headers: { authorization: 'Bearer anon-fixture' } }))).status, 401);
    await requireWorker(new Request('https://local/worker', { headers: { authorization: 'Bearer private-fixture' } }));
    Deno.env.delete('GENERATION_WORKER_SECRET');
    await rejects(() => requireWorker(new Request('https://local/worker', { headers: { authorization: 'Bearer private-fixture' } })));
  } finally { if (original) Deno.env.set('GENERATION_WORKER_SECRET', original); else Deno.env.delete('GENERATION_WORKER_SECRET'); }
});
Deno.test('body limit stops unknown-length streams and output rejects untrusted locations', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(10)); }, cancel() { cancelled = true; } });
  await rejects(() => boundedText(new Request('https://local', { method: 'POST', body: stream }), 15));
  equal(cancelled, true);
  for (const url of ['http://replicate.delivery/image.png','https://replicate.delivery.evil.test/image.png','https://evil.test/image.png']) await rejects(() => outputUrl(url));
  equal(outputUrl(['https://replicate.delivery/image.png']), 'https://replicate.delivery/image.png');
  await rejects(() => readOutput('https://replicate.delivery/image.png', (async () => new Response('', { headers: { 'content-length': String(26 * 1024 * 1024) } })) as typeof fetch));
});
