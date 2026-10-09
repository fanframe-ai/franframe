import pg from 'pg';
import { readFileSync } from 'node:fs';

const apply = process.argv.includes('--apply');
const config = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {};
if (process.env.PGSSLROOTCERT) config.ssl = { ca: readFileSync(process.env.PGSSLROOTCERT, 'utf8'), rejectUnauthorized: true };
const db = new pg.Client(config);
const url = process.env.SUPABASE_URL;
const secret = process.env.GENERATION_WORKER_SECRET;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
try {
  await db.connect();
  if (process.env.PGUSER?.startsWith('cli_login_postgres')) await db.query('SET ROLE postgres');
  if (apply) {
    if (!url || !secret || secret.length < 32 || !accessToken) throw new Error('configuration_missing');
    const target = new URL(url);
    if (target.protocol !== 'https:' || !target.hostname.endsWith('.supabase.co')) throw new Error('invalid_project_url');
    const project = target.hostname.split('.')[0];
    const { rows: [control] } = await db.query("SELECT admissions_paused,dispatch_paused FROM public.generation_controls WHERE scope='global'");
    if (!control?.admissions_paused || !control.dispatch_paused) throw new Error('pause_before_setup');
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/secrets`, {
      method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body:JSON.stringify([{name:'GENERATION_WORKER_SECRET',value:secret}]),signal:AbortSignal.timeout(30000),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('secret_configuration_failed'); }
    await response.body?.cancel();
    await db.query('BEGIN');
    try {
      for (const [name,value] of [['fanframe_supabase_url',url],['fanframe_worker_secret',secret]]) {
        const {rows:[existing]}=await db.query('SELECT id FROM vault.secrets WHERE name=$1',[name]);
        if (existing) await db.query('SELECT vault.update_secret($1,$2,$3)',[existing.id,value,name]);
        else await db.query('SELECT vault.create_secret($1,$2)',[value,name]);
      }
      await db.query('SELECT public.install_generation_schedule()');
      await db.query('COMMIT');
    } catch(error) { await db.query('ROLLBACK'); throw error; }
    const worker = await fetch(`${url}/functions/v1/generation-worker`, { method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(135000) });
    if (!worker.ok) { await worker.body?.cancel(); throw new Error('worker_probe_failed'); }
    const result=await worker.json();
    if(typeof result.processed!=='number') throw new Error('worker_response_invalid');
    console.log('Authenticated worker probe passed.');
  }
  const {rows:jobs}=await db.query("SELECT jobname,schedule,active FROM cron.job WHERE jobname LIKE 'fanframe-%' ORDER BY jobname");
  console.log(JSON.stringify({jobs,controls:(await db.query("SELECT scope,admissions_paused,dispatch_paused,event_budget_cents,daily_budget_cents,margin_percent,max_active,max_waiting,starts_per_minute,worker_seen_at FROM public.generation_controls ORDER BY scope")).rows},null,2));
  if(apply && (jobs.length!==3 || jobs.some(job=>!job.active))) throw new Error('scheduler_readback_failed');
} catch(error) {
  console.error('Generation scheduler setup/check failed:', error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'operation_failed', error?.code || '');
  process.exitCode=1;
} finally { await db.end().catch(()=>{}); }
