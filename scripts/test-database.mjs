import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import pg from 'pg';

const rootUrl = process.env.TEST_DATABASE_URL || 'postgres://localhost:55432/postgres';
const admin = new pg.Client({ connectionString: rootUrl });
const database = `fanframe_test_${process.pid}`;
await admin.connect();
await admin.query(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$`);
await admin.query(`CREATE DATABASE ${database}`);
const url = new URL(rootUrl);
url.pathname = `/${database}`;
const db = new pg.Client({ connectionString: url.href });
try {
  await db.connect();
  await db.query(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false, file_size_limit bigint);
    CREATE TABLE storage.objects (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, bucket_id text NOT NULL);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE PUBLICATION supabase_realtime;
    CREATE EXTENSION pgcrypto;
    INSERT INTO auth.users VALUES ('53ee3e7f-21bb-4fc6-9294-a6a116f6d819');
  `);
  const files = (await readdir(resolve('supabase/migrations'))).filter(name => name.endsWith('.sql')).sort();
  for (const file of files) {
    if (file.startsWith('20261008210000')) {
      await db.query("INSERT INTO public.system_settings(key,value) VALUES('shirts_text_overrides',$1)", [JSON.stringify({ 'manto-1': { name: 'Camisa de teste', hidden: true } })]);
    }
    let sql = await readFile(resolve('supabase/migrations', file), 'utf8');
    // These two Supabase-hosted extensions do not exist in plain PostgreSQL.
    sql = sql.replace(/^CREATE EXTENSION IF NOT EXISTS pg_(cron|net);\s*$/gm, '');
    try { await db.query(sql); }
    catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }); }
  }
  const team = (await db.query("SELECT id FROM public.teams WHERE slug='corinthians'")).rows[0].id;
  const migratedShirt = (await db.query("SELECT shirts->0->>'name' AS name, shirts->0->>'visible' AS visible FROM public.teams WHERE id=$1", [team])).rows[0];
  assert.equal(migratedShirt.name, 'Camisa de teste');
  assert.equal(migratedShirt.visible, 'false');
  const link = (await db.query('INSERT INTO public.test_links(team_id,credits_total) VALUES($1,1) RETURNING id,token', [team])).rows[0];
  assert.equal(link.token.length, 48);
  const jobId = '11111111-1111-4111-8111-111111111111';
  const args = [jobId, team, `test:${link.id}`, 'hash', link.id, 1, 'manto-1', 'https://example.com/shirt', 'https://example.com/background', 'consent'];
  const reserve = 'SELECT public.reserve_generation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS result';
  assert.equal((await db.query(reserve, args)).rows[0].result.created, true);
  assert.equal((await db.query(reserve, args)).rows[0].result.created, false);
  assert.equal((await db.query('SELECT credits_used FROM public.test_links WHERE id=$1', [link.id])).rows[0].credits_used, 1);
  await assert.rejects(db.query(reserve, ['22222222-2222-4222-8222-222222222222', ...args.slice(1)]), /no_credits/);
  await assert.rejects(db.query(reserve, [jobId, team, 'test:other', ...args.slice(3)]), /idempotency_conflict/);
  await db.query('SELECT public.fail_generation($1,$2)', [jobId, 'provider_error']);
  await db.query('SELECT public.fail_generation($1,$2)', [jobId, 'provider_error']);
  assert.equal((await db.query('SELECT credits_used FROM public.test_links WHERE id=$1', [link.id])).rows[0].credits_used, 0);
  await db.query(reserve, ['33333333-3333-4333-8333-333333333333', ...args.slice(1)]);
  await db.query('SELECT public.finish_generation($1,$2)', ['33333333-3333-4333-8333-333333333333', 'path/result.png']);
  await db.query('SELECT public.finish_generation($1,$2)', ['33333333-3333-4333-8333-333333333333', 'other']);
  assert.equal((await db.query('SELECT credits_used FROM public.test_links WHERE id=$1', [link.id])).rows[0].credits_used, 1);
  assert.equal((await db.query("SELECT status,result_storage_path FROM public.generation_queue WHERE id='33333333-3333-4333-8333-333333333333'")).rows[0].result_storage_path, 'path/result.png');
  const otherTeam = (await db.query("INSERT INTO public.teams(slug,name,subdomain) VALUES('other','Other','other') RETURNING id")).rows[0].id;
  const wordpressA = ['44444444-4444-4444-8444-444444444444', team, 'wp:42', 'hash-a', null, 1, 'manto-1', 'https://example.com/shirt', 'https://example.com/background', 'consent'];
  const wordpressB = ['55555555-5555-4555-8555-555555555555', otherTeam, 'wp:42', 'hash-b', null, 1, 'shirt', 'https://example.com/shirt', 'https://example.com/background', 'consent'];
  assert.equal((await db.query(reserve, wordpressA)).rows[0].result.created, true);
  assert.equal((await db.query(reserve, wordpressB)).rows[0].result.created, true);
  await assert.rejects(db.query(reserve, ['66666666-6666-4666-8666-666666666666', ...wordpressA.slice(1)]), /no_credits/);
  await assert.rejects(db.query(reserve, [wordpressA[0], otherTeam, ...wordpressA.slice(2)]), /idempotency_conflict/);
  await db.query('SELECT public.finish_generation($1,$2)', [wordpressA[0], 'path/wordpress.png']);
  assert.equal((await db.query('SELECT status,billing_completed FROM public.generation_queue WHERE id=$1', [wordpressA[0]])).rows[0].status, 'awaiting_payment');
  await db.query('SELECT public.confirm_generation_payment($1)', [wordpressA[0]]);
  await db.query('SELECT public.confirm_generation_payment($1)', [wordpressA[0]]);
  assert.equal((await db.query('SELECT status,billing_completed FROM public.generation_queue WHERE id=$1', [wordpressA[0]])).rows[0].billing_completed, true);
  assert.equal((await db.query('SELECT status FROM public.generation_queue WHERE id=$1', [wordpressB[0]])).rows[0].status, 'pending');

  const concurrentLink = (await db.query('INSERT INTO public.test_links(team_id,credits_total) VALUES($1,1) RETURNING id', [team])).rows[0];
  const contenders = [new pg.Client({ connectionString: url.href }), new pg.Client({ connectionString: url.href })];
  try {
    await Promise.all(contenders.map(client => client.connect()));
    const outcomes = await Promise.allSettled(contenders.map((client, index) => client.query(reserve, [
      index === 0 ? '77777777-7777-4777-8777-777777777777' : '88888888-8888-4888-8888-888888888888',
      team, `test:${concurrentLink.id}`, 'same-photo', concurrentLink.id, 1, 'manto-1',
      'https://example.com/shirt', 'https://example.com/background', 'consent',
    ])));
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1, 'only one concurrent reservation must succeed');
    assert.equal((await db.query('SELECT credits_used FROM public.test_links WHERE id=$1', [concurrentLink.id])).rows[0].credits_used, 1);
  } finally { await Promise.allSettled(contenders.map(client => client.end())); }
  const policies = await db.query("SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('generation_queue','test_links','team_secrets','fanframe_sessions')");
  assert(!policies.rows.some(row => /Anyone|Anon|Service role can manage queue/.test(row.policyname)));
  assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='tryon-temp'")).rows[0].public, false);
  await db.query("UPDATE public.team_secrets SET replicate_api_token='secret' WHERE team_id=$1", [team]);
  await db.query("INSERT INTO public.fanframe_sessions(team_id,token_hash,external_user_id,expires_at) VALUES($1,'hash','1',now()+interval '1 hour')", [team]);
  await db.query('GRANT USAGE ON SCHEMA public TO anon');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.generation_queue,public.test_links,public.team_secrets,public.fanframe_sessions TO anon');
  await db.query('GRANT USAGE ON SCHEMA storage TO anon,authenticated');
  await db.query('GRANT INSERT,SELECT ON storage.objects TO anon,authenticated');
  await db.query('GRANT USAGE ON SEQUENCE storage.objects_id_seq TO anon,authenticated');
  await db.query('SET ROLE anon');
  try {
    for (const table of ['generation_queue', 'test_links', 'team_secrets', 'fanframe_sessions']) {
      assert.equal((await db.query(`SELECT count(*)::int AS count FROM public.${table}`)).rows[0].count, 0, `${table} exposed`);
    }
    await assert.rejects(db.query("INSERT INTO public.test_links(team_id) VALUES($1)", [team]), /row-level security/);
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id) VALUES('tryon-assets')"), /row-level security/);
  } finally { await db.query('RESET ROLE'); }
  await db.query("SELECT set_config('request.jwt.claim.sub','53ee3e7f-21bb-4fc6-9294-a6a116f6d819',false)");
  await db.query('SET ROLE authenticated');
  try {
    await db.query("INSERT INTO storage.objects(bucket_id) VALUES('tryon-assets')");
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id) VALUES('tryon-temp')"), /row-level security/);
  } finally {
    await db.query('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
  }
  console.log(`Database migration replay and transaction tests passed (${files.length} migrations).`);
} finally {
  await db.end().catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  await admin.end();
}
