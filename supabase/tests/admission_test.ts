import { handler } from '../functions/generation-status/index.ts';
function check(value:unknown,message:string){if(!value)throw new Error(message);}
Deno.test('admission authenticates before lightweight capacity probing, never uploads or reserves credit',async()=>{
  const original=globalThis.fetch;
  const env=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].map(key=>[key,Deno.env.get(key)] as const);
  const queries:string[]=[];let phase='ready';
  try{
    Deno.env.set('SUPABASE_URL','https://fixture.supabase.co');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fixture-service-key');
    globalThis.fetch=(async(input,init)=>{
      const url=new URL(input instanceof Request?input.url:String(input));queries.push(url.pathname);
      if(url.pathname.endsWith('/teams'))return Response.json({id:'team',slug:'fixture',name:'Fixture',is_active:true,shirts:[],backgrounds:[]});
      if(url.pathname.endsWith('/test_links'))return Response.json({id:'link',credits_total:1,credits_used:0,expires_at:null});
      if(url.pathname.endsWith('/rpc/generation_admission')){
        check(JSON.parse(String(init?.body)).p_team==='team','Capacity stays on authenticated team');
        return Response.json({available:false,reason:'queue_full'});
      }
      if(url.pathname.endsWith('/generation_queue'))return Response.json({id:'job',status:phase==='ready'?'pending':'processing',work_stage:phase,created_at:new Date(Date.now()-180000).toISOString()});
      throw new Error('Unexpected request: no upload, provider or reservation allowed');
    }) as typeof fetch;
    const request=(body:object)=>new Request('https://fixture/status',{method:'POST',body:JSON.stringify(body)});
    check((await handler(request({team_slug:'fixture',action:'admission'}))).status===400,'Missing credentials rejected');
    check(!queries.some(path=>path.endsWith('/rpc/generation_admission')),'Unauthenticated caller cannot probe capacity');
    const response=await handler(request({team_slug:'fixture',test_token:'token',action:'admission'}));
    const value=await response.json();check(response.status===200 && !value.available && value.reason==='queue_full','Capacity response is advisory');
    check(value.next_poll_after===30,'Overflow clients avoid rapid retries');
    for(const stage of ['ready','submitting','uncertain','running','output']){
      phase=stage;
      const job=await (await handler(request({team_slug:'fixture',test_token:'token',queue_id:'job'}))).json();
      check(job.phase==={ready:'preparing',submitting:'preparing',uncertain:'preparing',running:'generating',output:'finishing'}[stage],'Only real server phase is exposed');
      check(job.next_poll_after===(['ready','submitting','uncertain'].includes(stage)?30:5),'Long preparation polls slowly');
      check(!('work_stage' in job) && !('owner_id' in job),'Private queue fields stay private');
    }
  } finally{
    globalThis.fetch=original;
    for(const [key,value] of env){if(value===undefined)Deno.env.delete(key);else Deno.env.set(key,value);}
  }
});
