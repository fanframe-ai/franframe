import { probe, httpOutcome, overallProbeStatus } from '../functions/_shared/health.ts';
import { diagnosticRecord } from '../functions/_shared/diagnostics.ts';
import { endpoint, HttpError } from '../functions/_shared/http.ts';
import { edge, handler as healthHandler } from '../functions/health-check/index.ts';
function equal(a: unknown,b: unknown) { if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
Deno.test('edge availability requires the real handler, not an auth gateway or arbitrary body',async()=>{
  const original=globalThis.fetch;const oldUrl=Deno.env.get('SUPABASE_URL');const oldKey=Deno.env.get('SUPABASE_ANON_KEY');
  Deno.env.set('SUPABASE_URL','https://fixture.example');Deno.env.set('SUPABASE_ANON_KEY','fixture-public');
  try{
    for(const [status,body,expected] of [[401,'{}','unknown'],[200,'{}','unknown'],[400,'not-json','unknown'],[400,'{"error":"other"}','unknown'],[400,'{"error":"invalid_team"}','operational']] as const){
      globalThis.fetch=()=>Promise.resolve(new Response(body,{status}));equal((await edge()).status,expected);
    }
  }finally{globalThis.fetch=original;for(const [key,value] of [['SUPABASE_URL',oldUrl],['SUPABASE_ANON_KEY',oldKey]]){if(value===undefined)Deno.env.delete(key!);else Deno.env.set(key!,value);}}
});
Deno.test('health persistence failure cannot masquerade as a completed check',async()=>{
  const originalFetch=globalThis.fetch;const OriginalSocket=globalThis.WebSocket;
  const values={SUPABASE_URL:'https://fixture.example',SUPABASE_SERVICE_ROLE_KEY:'fixture-private',SUPABASE_ANON_KEY:'fixture-public',GENERATION_WORKER_SECRET:'fixture-worker',REPLICATE_API_TOKEN:'fixture-provider'};
  const old=Object.fromEntries(Object.keys(values).map(key=>[key,Deno.env.get(key)]));
  Object.entries(values).forEach(([key,value])=>Deno.env.set(key,value));
  globalThis.WebSocket=class {
    onopen:(()=>void)|null=null;onerror:(()=>void)|null=null;onclose:(()=>void)|null=null;
    constructor(){queueMicrotask(()=>this.onopen?.());}close(){}
  } as unknown as typeof WebSocket;
  globalThis.fetch=(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    let data:unknown=[];let status=200;
    if(url.pathname.endsWith('/admin/users'))data={users:[]};
    else if(url.pathname.endsWith('/generation-status')){data={error:'invalid_team'};status=400;}
    else if(url.pathname.endsWith('/teams'))data={shirts:[{assetPath:'https://fixture.example/image.png'}]};
    else if(url.pathname.endsWith('/image.png'))return Promise.resolve(new Response(null,{headers:{'content-type':'image/png'}}));
    else if(url.pathname.endsWith('/health_checks') && init?.method==='POST'){data={code:'42501',message:'fixture failure with secret'};status=403;}
    return Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}}));
  };
  try{
    const denied=await healthHandler(new Request('https://fixture.example/health-check',{method:'POST',body:'{}'}));equal(denied.status,401);
    const result=await healthHandler(new Request('https://fixture.example/health-check',{method:'POST',headers:{authorization:'Bearer fixture-worker'},body:'{}'}));
    const value=await result.json();equal(result.status,503);equal(value.success,false);equal(value.persisted,false);equal(value.results.length,6);
  }finally{globalThis.fetch=originalFetch;globalThis.WebSocket=OriginalSocket;for(const [key,value] of Object.entries(old)){if(value===undefined)Deno.env.delete(key);else Deno.env.set(key,value);}}
});
Deno.test('slow successful probes stay available and transient failures recover',async()=>{
  let time=0;
  const slow=await probe('db','Database',async()=>({status:'operational'}),async()=>{},()=>{time+=3000;return time;});
  equal(slow.status,'operational');equal(slow.response_time_ms,3000);
  let calls=0;
  const recovered=await probe('db','Database',async()=>{calls++;if(calls===1)throw new Error('lost connection with private token');return {status:'operational'};},async()=>{});
  equal(calls,2);equal(recovered.status,'operational');equal(recovered.error_message,undefined);
  calls=0;const failed=await probe('db','Database',async()=>{calls++;return {status:'major_outage',code:'http_503'};},async()=>{});
  equal(calls,2);equal(failed.status,'major_outage');equal(failed.error_message,'http_503 (confirmado em 2 tentativas)');
});
Deno.test('configuration, permission and throttling do not imply global downtime',async()=>{
  equal(httpOutcome(401),{status:'unknown',code:'probe_not_authorized'});
  equal(httpOutcome(429),{status:'degraded',code:'rate_limited'});
  equal(overallProbeStatus(['operational','major_outage']),'partial_outage');
  equal(overallProbeStatus(['major_outage','major_outage']),'major_outage');
  let calls=0;const result=await probe('api','API',async()=>{calls++;return httpOutcome(401);},async()=>{});
  equal(calls,1);equal(result.status,'unknown');
});
Deno.test('diagnostics discard secrets and responses correlate without changing errors',async()=>{
  const record=diagnosticRecord('error','fixture_failed',{function:'generation-worker',generation_id:'11111111-1111-4111-8111-111111111111',token:'secret-token',message:'secret-photo',url:'https://storage.test/?token=secret',body:{password:'secret'},code:'https://secret.test',duration_ms:10});
  equal(Object.keys(record).sort(),['duration_ms','event','function','generation_id','level','timestamp'].sort());
  const handler=endpoint(async()=>{throw new HttpError(503,'queue_unavailable');});
  const result=await handler(new Request('https://fixture/generate-tryon',{method:'POST'}));
  equal(result.status,503);const value=await result.json();equal(value.error,'queue_unavailable');equal(value.request_id,result.headers.get('x-fanframe-request-id'));
  equal(result.headers.get('cache-control'),'no-store');
});
