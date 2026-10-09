SET LOCAL search_path = public, extensions;

CREATE TABLE public.generation_controls (
  scope text PRIMARY KEY DEFAULT 'global',
  admissions_paused boolean NOT NULL DEFAULT true,
  dispatch_paused boolean NOT NULL DEFAULT true,
  event_budget_cents integer NOT NULL DEFAULT 30000 CHECK (event_budget_cents BETWEEN 1 AND 30000000),
  daily_budget_cents integer NOT NULL DEFAULT 30000 CHECK (daily_budget_cents BETWEEN 1 AND 30000000),
  margin_percent integer NOT NULL DEFAULT 10 CHECK (margin_percent BETWEEN 0 AND 50),
  max_active integer NOT NULL DEFAULT 20 CHECK (max_active BETWEEN 1 AND 100),
  max_waiting integer NOT NULL DEFAULT 120 CHECK (max_waiting BETWEEN 1 AND 600),
  starts_per_minute integer NOT NULL DEFAULT 30 CHECK (starts_per_minute BETWEEN 1 AND 120),
  cooldown_until timestamptz,
  worker_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.generation_controls(scope) VALUES ('global');
ALTER TABLE public.generation_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read generation controls" ON public.generation_controls FOR SELECT TO authenticated USING (is_admin(auth.uid()));
GRANT SELECT ON public.generation_controls TO authenticated;
GRANT ALL ON public.generation_controls TO service_role;

CREATE TABLE public.generation_actor_leases (
  team_id uuid NOT NULL REFERENCES teams(id), owner_id text NOT NULL,
  lease_id uuid NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(team_id,owner_id)
);
ALTER TABLE public.generation_actor_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.generation_actor_leases FROM anon,authenticated;
GRANT ALL ON public.generation_actor_leases TO service_role;

ALTER TABLE public.generation_queue
  ADD COLUMN work_stage text NOT NULL DEFAULT 'legacy' CHECK (work_stage IN ('legacy','uploading','ready','submitting','uncertain','running','output','settled','failed')),
  ADD COLUMN cost_cents integer NOT NULL DEFAULT 0 CHECK (cost_cents>=0),
  ADD COLUMN cost_state text NOT NULL DEFAULT 'none' CHECK (cost_state IN ('none','reserved','spent','released')),
  ADD COLUMN parameters jsonb,
  ADD COLUMN lease_id uuid,
  ADD COLUMN lease_until timestamptz,
  ADD COLUMN attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN output_url text,
  ADD COLUMN last_event_at timestamptz;
UPDATE generation_queue SET work_stage=CASE
  WHEN status IN ('completed','awaiting_payment') THEN 'settled'
  WHEN status='failed' THEN 'failed'
  WHEN status='processing' AND replicate_prediction_id IS NOT NULL THEN 'running'
  WHEN status='processing' THEN 'uncertain' ELSE 'legacy' END;
CREATE INDEX generation_work_eligible ON generation_queue(work_stage,next_attempt_at,created_at) WHERE status IN ('pending','processing');
CREATE INDEX generation_cost_exposure ON generation_queue(team_id,created_at) INCLUDE(cost_cents,cost_state) WHERE cost_state IN ('reserved','spent');

CREATE FUNCTION public.acquire_generation_actor(p_team uuid,p_owner text,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO generation_actor_leases VALUES(p_team,p_owner,p_lease,now()+interval '30 seconds')
    ON CONFLICT(team_id,owner_id) DO UPDATE SET lease_id=excluded.lease_id,expires_at=excluded.expires_at
    WHERE generation_actor_leases.expires_at<now();
  RETURN FOUND;
END $$;
CREATE FUNCTION public.release_generation_actor(p_team uuid,p_owner text,p_lease uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  DELETE FROM generation_actor_leases WHERE team_id=p_team AND owner_id=p_owner AND lease_id=p_lease;
$$;

CREATE OR REPLACE FUNCTION public.reserve_generation(
  p_id uuid,p_team uuid,p_owner text,p_hash text,p_test_link uuid,p_balance integer,
  p_shirt text,p_shirt_url text,p_background_url text,p_consent text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job generation_queue; link test_links; controls generation_controls; budget bigint; daily bigint; item record;
BEGIN
  SELECT * INTO controls FROM generation_controls WHERE scope='global' FOR UPDATE;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_team::text||':'||p_owner,0));
  SELECT * INTO job FROM generation_queue WHERE id=p_id FOR UPDATE;
  IF FOUND THEN
    IF job.team_id<>p_team OR job.owner_id<>p_owner OR job.request_hash<>p_hash THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN jsonb_build_object('created',false,'id',job.id,'status',job.status);
  END IF;
  IF controls.admissions_paused THEN RAISE EXCEPTION 'admissions_paused'; END IF;
  IF NOT EXISTS(SELECT 1 FROM teams WHERE id=p_team AND is_active) THEN RAISE EXCEPTION 'team_unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM generation_queue WHERE team_id=p_team AND owner_id=p_owner AND status IN ('pending','processing','awaiting_payment')) THEN RAISE EXCEPTION 'generation_active'; END IF;
  IF (SELECT count(*) FROM generation_queue WHERE team_id=p_team AND owner_id=p_owner AND created_at>now()-interval '1 hour')>=25 THEN RAISE EXCEPTION 'rate_limit_exceeded'; END IF;
  IF (SELECT count(*) FROM generation_queue WHERE work_stage IN ('uploading','ready'))>=controls.max_waiting THEN RAISE EXCEPTION 'queue_full'; END IF;
  FOR item IN SELECT * FROM generation_controls WHERE scope IN ('global',p_team::text) ORDER BY scope LOOP
    IF item.admissions_paused THEN RAISE EXCEPTION 'admissions_paused'; END IF;
    IF item.scope<>'global' AND (SELECT count(*) FROM generation_queue WHERE team_id=p_team AND work_stage IN ('uploading','ready'))>=item.max_waiting THEN RAISE EXCEPTION 'queue_full'; END IF;
    SELECT coalesce(sum(cost_cents),0),coalesce(sum(cost_cents) FILTER(WHERE cost_state='reserved' OR created_at>=(date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')),0)
      INTO budget,daily FROM generation_queue WHERE cost_state IN ('reserved','spent') AND (item.scope='global' OR team_id=p_team);
    IF budget+9>floor(item.event_budget_cents*(100-item.margin_percent)/100.0)
      OR daily+9>floor(item.daily_budget_cents*(100-item.margin_percent)/100.0) THEN RAISE EXCEPTION 'budget_exhausted'; END IF;
  END LOOP;
  IF p_test_link IS NOT NULL THEN
    SELECT * INTO link FROM test_links WHERE id=p_test_link AND team_id=p_team FOR UPDATE;
    IF NOT FOUND OR NOT link.is_active OR (link.expires_at IS NOT NULL AND link.expires_at<=now()) THEN RAISE EXCEPTION 'invalid_test_link'; END IF;
    IF link.credits_used>=link.credits_total THEN RAISE EXCEPTION 'no_credits'; END IF;
    UPDATE test_links SET credits_used=credits_used+1 WHERE id=p_test_link;
  ELSIF p_balance<1 THEN RAISE EXCEPTION 'no_credits'; END IF;
  INSERT INTO generation_queue(id,team_id,owner_id,user_id,test_link_id,request_hash,shirt_id,user_image_url,shirt_asset_url,background_asset_url,credit_reserved,work_stage,cost_cents,cost_state)
    VALUES(p_id,p_team,p_owner,p_owner,p_test_link,p_hash,p_shirt,'',p_shirt_url,p_background_url,p_test_link IS NOT NULL,'uploading',9,'reserved');
  INSERT INTO generations(id,team_id,external_user_id,shirt_id,status) VALUES(p_id,p_team,p_owner,p_shirt,'pending');
  INSERT INTO consent_logs(team_id,user_id,consent_text) VALUES(p_team,p_owner,p_consent);
  RETURN jsonb_build_object('created',true,'id',p_id,'status','pending');
END $$;

CREATE OR REPLACE FUNCTION public.fail_generation(p_id uuid,p_error text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job generation_queue;
BEGIN
  SELECT * INTO job FROM generation_queue WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR job.status IN ('failed','completed','awaiting_payment') THEN RETURN; END IF;
  IF job.credit_reserved THEN UPDATE test_links SET credits_used=greatest(0,credits_used-1) WHERE id=job.test_link_id; END IF;
  UPDATE generation_queue SET status='failed',work_stage='failed',credit_reserved=false,lease_id=null,lease_until=null,
    cost_state=CASE WHEN cost_state='reserved' THEN CASE WHEN job.work_stage IN ('uploading','ready') THEN 'released' ELSE 'spent' END ELSE cost_state END,
    error_message=p_error,completed_at=now() WHERE id=p_id;
  UPDATE generations SET status='failed',error_message=p_error,completed_at=now() WHERE id=p_id;
END $$;

CREATE OR REPLACE FUNCTION public.finish_generation(p_id uuid,p_path text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job generation_queue; next_status text;
BEGIN
  SELECT * INTO job FROM generation_queue WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR job.status IN ('failed','completed','awaiting_payment') THEN RETURN; END IF;
  next_status:=CASE WHEN job.test_link_id IS NOT NULL THEN 'completed' ELSE 'awaiting_payment' END;
  UPDATE generation_queue SET status=next_status,work_stage='settled',result_storage_path=p_path,credit_reserved=false,
    billing_completed=(test_link_id IS NOT NULL),completed_at=now(),cost_state=CASE WHEN cost_cents>0 THEN 'spent' ELSE cost_state END,
    lease_id=null,lease_until=null,output_url=null WHERE id=p_id;
  UPDATE generations SET status=CASE WHEN next_status='completed' THEN 'completed'::generation_status ELSE 'processing'::generation_status END,
    completed_at=now(),processing_time_ms=extract(epoch FROM now()-job.created_at)*1000 WHERE id=p_id;
END $$;

CREATE FUNCTION public.mark_generation_ready(p_id uuid,p_path text,p_parameters jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE generation_queue SET user_image_url=p_path,parameters=p_parameters,work_stage='ready',next_attempt_at=now()
    WHERE id=p_id AND work_stage='uploading' AND status='pending';
  RETURN FOUND;
END $$;

CREATE FUNCTION public.claim_generation_work() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE controls generation_controls; job generation_queue; kind text;
BEGIN
  SELECT * INTO controls FROM generation_controls WHERE scope='global' FOR UPDATE;
  UPDATE generation_controls SET worker_seen_at=now() WHERE scope='global';
  UPDATE generation_queue SET work_stage='uncertain',lease_id=null,lease_until=null
    WHERE work_stage='submitting' AND lease_until<now();
  -- One bounded maintenance item per invocation, without network inside a transaction.
  SELECT * INTO job FROM generation_queue WHERE work_stage IN ('uploading','ready') AND created_at<now()-interval '10 minutes' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF FOUND THEN PERFORM fail_generation(job.id,'A espera expirou. Seu credito foi preservado.'); END IF;
  IF (SELECT count(*) FROM generation_queue WHERE work_stage='output' AND lease_until>now())<4 THEN
    SELECT * INTO job FROM generation_queue WHERE work_stage='output' AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF FOUND THEN kind:='persist'; END IF;
  END IF;
  IF kind IS NULL THEN
    SELECT * INTO job FROM generation_queue WHERE work_stage IN ('running','uncertain') AND next_attempt_at<=now()
      AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF FOUND THEN kind:='reconcile'; END IF;
  END IF;
  IF kind IS NULL AND NOT controls.dispatch_paused AND (controls.cooldown_until IS NULL OR controls.cooldown_until<now())
    AND (SELECT count(*) FROM generation_queue WHERE work_stage IN ('submitting','running','uncertain'))<controls.max_active
    AND (SELECT count(*) FROM generation_queue WHERE submitted_at>now()-interval '1 minute')<controls.starts_per_minute
    AND (SELECT count(*) FROM generation_queue WHERE submitted_at>now()-interval '10 seconds')<5 THEN
    SELECT q.* INTO job FROM generation_queue q WHERE work_stage='ready' AND next_attempt_at<=now()
      AND NOT EXISTS(SELECT 1 FROM generation_controls t WHERE t.scope=q.team_id::text AND
        (t.dispatch_paused OR (SELECT count(*) FROM generation_queue a WHERE a.team_id=q.team_id AND a.work_stage IN ('submitting','running','uncertain'))>=t.max_active
          OR (SELECT count(*) FROM generation_queue a WHERE a.team_id=q.team_id AND a.submitted_at>now()-interval '1 minute')>=t.starts_per_minute))
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF FOUND THEN kind:='dispatch'; END IF;
  END IF;
  IF kind IS NULL THEN RETURN null; END IF;
  UPDATE generation_queue SET lease_id=gen_random_uuid(),lease_until=now()+interval '90 seconds',
    work_stage=CASE WHEN kind='dispatch' THEN 'submitting' ELSE work_stage END,
    status=CASE WHEN kind='dispatch' THEN 'processing' ELSE status END,
    started_at=CASE WHEN kind='dispatch' THEN coalesce(started_at,now()) ELSE started_at END,
    submitted_at=CASE WHEN kind='dispatch' THEN now() ELSE submitted_at END,
    attempts=attempts+CASE WHEN kind='dispatch' THEN 1 ELSE 0 END,
    next_attempt_at=now()+interval '1 minute' WHERE id=job.id RETURNING * INTO job;
  RETURN jsonb_build_object('kind',kind,'job',to_jsonb(job));
END $$;

CREATE FUNCTION public.update_generation_work(p_id uuid,p_lease uuid,p_action text,p_value text DEFAULT null,p_delay integer DEFAULT 60) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job generation_queue;
BEGIN
  SELECT * INTO job FROM generation_queue WHERE id=p_id AND lease_id=p_lease AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_action='key' THEN UPDATE generation_queue SET webhook_signing_key=p_value WHERE id=p_id; RETURN true;
  ELSIF p_action='prediction' THEN
    IF job.replicate_prediction_id IS NOT NULL AND job.replicate_prediction_id<>p_value THEN RAISE EXCEPTION 'prediction_mismatch'; END IF;
    UPDATE generation_queue SET replicate_prediction_id=p_value,work_stage='running',lease_id=null,lease_until=null,next_attempt_at=now()+interval '3 minutes' WHERE id=p_id;
    UPDATE generations SET status='processing' WHERE id=p_id;
  ELSIF p_action='throttled' THEN
    UPDATE generation_queue SET work_stage='ready',status='pending',lease_id=null,lease_until=null,next_attempt_at=now()+make_interval(secs=>greatest(5,least(300,p_delay))) WHERE id=p_id;
    UPDATE generation_controls SET cooldown_until=now()+make_interval(secs=>greatest(5,least(300,p_delay))) WHERE scope='global';
  ELSIF p_action='uncertain' THEN
    UPDATE generation_queue SET work_stage='uncertain',lease_id=null,lease_until=null,next_attempt_at=now()+interval '1 minute' WHERE id=p_id;
  ELSIF p_action='retry' THEN
    UPDATE generation_queue SET lease_id=null,lease_until=null,next_attempt_at=now()+make_interval(secs=>greatest(5,least(300,p_delay))) WHERE id=p_id;
  ELSIF p_action='preflight_failed' THEN
    UPDATE generation_queue SET work_stage='ready' WHERE id=p_id;
    PERFORM fail_generation(p_id,'Nao foi possivel iniciar a geracao. Seu credito foi preservado.');
  ELSIF p_action='finish' THEN PERFORM finish_generation(p_id,p_value);
  ELSE RAISE EXCEPTION 'invalid_work_action'; END IF;
  RETURN true;
END $$;

CREATE FUNCTION public.record_generation_event(p_id uuid,p_prediction text,p_status text,p_output text DEFAULT null) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job generation_queue;
BEGIN
  SELECT * INTO job FROM generation_queue WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'generation_not_found'; END IF;
  IF p_prediction IS NULL OR length(p_prediction) NOT BETWEEN 1 AND 200 OR p_status IS NULL OR p_status NOT IN ('starting','processing','succeeded','failed','canceled') THEN RAISE EXCEPTION 'invalid_prediction_event'; END IF;
  IF job.replicate_prediction_id IS NOT NULL AND job.replicate_prediction_id<>p_prediction THEN RAISE EXCEPTION 'prediction_mismatch'; END IF;
  IF job.status IN ('completed','failed','awaiting_payment') OR job.work_stage='output' THEN RETURN; END IF;
  UPDATE generation_queue SET replicate_prediction_id=p_prediction,last_event_at=now() WHERE id=p_id;
  IF p_status='succeeded' THEN
    IF p_output IS NULL THEN PERFORM fail_generation(p_id,'O provedor nao retornou uma imagem.'); RETURN; END IF;
    UPDATE generation_queue SET work_stage='output',output_url=p_output,lease_id=null,lease_until=null,next_attempt_at=now(),cost_state=CASE WHEN cost_cents>0 THEN 'spent' ELSE cost_state END WHERE id=p_id;
  ELSIF p_status IN ('failed','canceled') THEN PERFORM fail_generation(p_id,'A geracao falhou. Seu credito foi preservado.');
  ELSE UPDATE generation_queue SET work_stage='running',next_attempt_at=now()+interval '3 minutes' WHERE id=p_id;
  END IF;
END $$;

CREATE FUNCTION public.generation_operations(p_team uuid DEFAULT null) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' AND NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT jsonb_build_object('controls',(SELECT to_jsonb(c) FROM generation_controls c WHERE scope='global'),
    'waiting',count(*) FILTER(WHERE work_stage IN ('uploading','ready')),
    'active',count(*) FILTER(WHERE work_stage IN ('submitting','running','uncertain')),
    'uncertain',count(*) FILTER(WHERE work_stage='uncertain'),
    'saving',count(*) FILTER(WHERE work_stage='output'),
    'awaiting_payment',count(*) FILTER(WHERE status='awaiting_payment'),
    'reserved_cents',coalesce(sum(cost_cents) FILTER(WHERE cost_state='reserved'),0),
    'spent_cents',coalesce(sum(cost_cents) FILTER(WHERE cost_state='spent'),0),
    'oldest_waiting_at',min(created_at) FILTER(WHERE work_stage IN ('uploading','ready')),
    'oldest_output_at',min(last_event_at) FILTER(WHERE work_stage='output'),
    'recent_completed',count(*) FILTER(WHERE status IN ('completed','awaiting_payment') AND completed_at>now()-interval '5 minutes'),
    'recent_failed',count(*) FILTER(WHERE status='failed' AND submitted_at IS NOT NULL AND completed_at>now()-interval '5 minutes'),
    'p95_total_seconds',percentile_cont(0.95) WITHIN GROUP(ORDER BY extract(epoch FROM completed_at-created_at)) FILTER(WHERE status IN ('completed','awaiting_payment') AND completed_at>now()-interval '5 minutes'),
    'p95_save_seconds',percentile_cont(0.95) WITHIN GROUP(ORDER BY extract(epoch FROM completed_at-last_event_at)) FILTER(WHERE status IN ('completed','awaiting_payment') AND last_event_at IS NOT NULL AND completed_at>now()-interval '5 minutes')) INTO result
    FROM generation_queue WHERE p_team IS NULL OR team_id=p_team;
  RETURN result;
END $$;

CREATE TABLE public.generation_control_audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor uuid,scope text,settings jsonb,created_at timestamptz DEFAULT now());
ALTER TABLE public.generation_control_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read control audit" ON public.generation_control_audit FOR SELECT TO authenticated USING(is_admin(auth.uid()));
GRANT SELECT ON public.generation_control_audit TO authenticated;
GRANT ALL ON public.generation_control_audit TO service_role;
CREATE FUNCTION public.configure_generation_controls(p_scope text,p_settings jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_scope<>'global' AND NOT EXISTS(SELECT 1 FROM teams WHERE id::text=p_scope) THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  PERFORM 1 FROM generation_controls WHERE scope='global' FOR UPDATE;
  INSERT INTO generation_controls(scope) VALUES(p_scope) ON CONFLICT DO NOTHING;
  UPDATE generation_controls SET admissions_paused=coalesce((p_settings->>'admissions_paused')::boolean,admissions_paused),
    dispatch_paused=coalesce((p_settings->>'dispatch_paused')::boolean,dispatch_paused),
    event_budget_cents=coalesce((p_settings->>'event_budget_cents')::integer,event_budget_cents),
    daily_budget_cents=coalesce((p_settings->>'daily_budget_cents')::integer,daily_budget_cents),
    max_active=coalesce((p_settings->>'max_active')::integer,max_active),
    max_waiting=coalesce((p_settings->>'max_waiting')::integer,max_waiting),
    starts_per_minute=coalesce((p_settings->>'starts_per_minute')::integer,starts_per_minute),updated_at=now() WHERE scope=p_scope;
  INSERT INTO generation_control_audit(actor,scope,settings) VALUES(auth.uid(),p_scope,p_settings);
END $$;

-- Every operational mutation is a server-only RPC; read/control RPCs validate admin identity.
DO $$ DECLARE fn record; BEGIN
  FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
    ('acquire_generation_actor','release_generation_actor','mark_generation_ready','claim_generation_work','update_generation_work','record_generation_event')
  LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature); END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.generation_operations(uuid),public.configure_generation_controls(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generation_operations(uuid),public.configure_generation_controls(text,jsonb) TO authenticated,service_role;

CREATE FUNCTION public.admin_generation_stats(p_start timestamptz,p_team uuid DEFAULT null) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE stats jsonb;
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_start<now()-interval '92 days' THEN RAISE EXCEPTION 'invalid_period'; END IF;
  WITH rows AS MATERIALIZED (SELECT * FROM generations WHERE created_at>=p_start AND (p_team IS NULL OR team_id=p_team)),
  totals AS (SELECT count(*) total,count(*) FILTER(WHERE status='completed') success,count(*) FILTER(WHERE status='failed') failed,
    coalesce(avg(processing_time_ms),0) AS avg_time,count(DISTINCT(team_id,external_user_id)) FILTER(WHERE external_user_id IS NOT NULL) unique_users FROM rows),
  hourly AS (SELECT extract(hour FROM created_at AT TIME ZONE 'America/Sao_Paulo') AS hour,count(*) AS count,count(*) FILTER(WHERE status='completed') success,count(*) FILTER(WHERE status='failed') failed FROM rows GROUP BY 1),
  daily AS (SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,count(*) total,count(*) FILTER(WHERE status='completed') success,count(*) FILTER(WHERE status='failed') failed FROM rows GROUP BY 1),
  shirts AS (SELECT shirt_id AS name,count(*) value FROM rows GROUP BY 1 ORDER BY 2 DESC LIMIT 50)
  SELECT jsonb_build_object('totals',to_jsonb(totals),'hourly',coalesce((SELECT jsonb_agg(hourly) FROM hourly),'[]'),
    'daily',coalesce((SELECT jsonb_agg(daily ORDER BY date) FROM daily),'[]'),'shirts',coalesce((SELECT jsonb_agg(shirts) FROM shirts),'[]'),
    'cost_cents',coalesce((SELECT sum(cost_cents) FROM generation_queue WHERE created_at>=p_start AND cost_state='spent' AND (p_team IS NULL OR team_id=p_team)),0)) INTO stats FROM totals;
  RETURN stats;
END $$;
REVOKE ALL ON FUNCTION public.admin_generation_stats(timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_generation_stats(timestamptz,uuid) TO authenticated;

ALTER TABLE public.system_alerts ADD COLUMN operation_key text;
CREATE UNIQUE INDEX generation_alert_once ON system_alerts(operation_key) WHERE operation_key IS NOT NULL AND NOT resolved;
CREATE FUNCTION public.monitor_generation_operations() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE controls generation_controls; exposure bigint; item record; recent_total integer; recent_failed integer;
BEGIN
  SELECT * INTO controls FROM generation_controls WHERE scope='global';
  SELECT coalesce(sum(cost_cents),0) INTO exposure FROM generation_queue WHERE cost_state IN ('reserved','spent');
  SELECT count(*),count(*) FILTER(WHERE status='failed') INTO recent_total,recent_failed FROM generation_queue
    WHERE submitted_at IS NOT NULL AND completed_at>now()-interval '5 minutes';
  FOR item IN SELECT * FROM (VALUES
    ('worker_stale',NOT controls.dispatch_paused AND (controls.worker_seen_at IS NULL OR controls.worker_seen_at<now()-interval '1 minute'),'Worker sem atualizacao ha mais de um minuto.'),
    ('output_stale',EXISTS(SELECT 1 FROM generation_queue WHERE work_stage='output' AND last_event_at<now()-interval '5 minutes'),'Foto pronta aguardando persistencia por mais de cinco minutos.'),
    ('prediction_uncertain',EXISTS(SELECT 1 FROM generation_queue WHERE work_stage='uncertain'),'Envio de geracao incerto. Reconciliar antes de repetir.'),
    ('queue_stale',EXISTS(SELECT 1 FROM generation_queue WHERE work_stage IN ('uploading','ready') AND created_at<now()-interval '5 minutes'),'Fila com pedidos aguardando ha mais de cinco minutos.'),
    ('generation_errors',recent_total>=20 AND recent_failed::numeric/greatest(1,recent_total)>0.02,'Mais de 2% de geracoes com falha nos ultimos cinco minutos (amostra minima 20).'),
    ('budget_85',exposure>=controls.event_budget_cents*0.85,'Exposicao de IA atingiu 85% do teto do evento.'),
    ('budget_70',exposure>=controls.event_budget_cents*0.70,'Exposicao de IA atingiu 70% do teto do evento.')
  ) AS conditions(key,active,message) LOOP
    IF item.active THEN
      INSERT INTO system_alerts(type,message,severity,operation_key) VALUES('api_error',item.message,CASE WHEN item.key='budget_70' THEN 'warning'::alert_severity ELSE 'critical'::alert_severity END,item.key) ON CONFLICT DO NOTHING;
    ELSE UPDATE system_alerts SET resolved=true,resolved_at=now() WHERE operation_key=item.key AND NOT resolved; END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.monitor_generation_operations() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.monitor_generation_operations() TO service_role;

ALTER TABLE public.system_alerts ADD COLUMN notification_lease_until timestamptz, ADD COLUMN notified_at timestamptz;
CREATE FUNCTION public.claim_generation_alert() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item system_alerts;
BEGIN
  SELECT * INTO item FROM system_alerts WHERE operation_key IS NOT NULL AND NOT resolved AND notified_at IS NULL
    AND (notification_lease_until IS NULL OR notification_lease_until<now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN null; END IF;
  UPDATE system_alerts SET notification_lease_until=now()+interval '1 minute' WHERE id=item.id;
  RETURN jsonb_build_object('id',item.id,'message',item.message,'severity',item.severity,'created_at',item.created_at);
END $$;
REVOKE ALL ON FUNCTION public.claim_generation_alert() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generation_alert() TO service_role;

CREATE FUNCTION public.install_generation_schedule() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Vault secrets are provisioned separately; no credential is embedded in migration history.
  IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='cron') OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='vault') THEN RAISE EXCEPTION 'scheduler_dependencies_unavailable'; END IF;
  EXECUTE $schedule$ SELECT cron.schedule('fanframe-generation-worker','5 seconds', $job$
    SELECT net.http_post(url:=u.decrypted_secret||'/functions/v1/generation-worker',
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||s.decrypted_secret),
      body:='{}'::jsonb,timeout_milliseconds:=120000)
    FROM vault.decrypted_secrets u CROSS JOIN vault.decrypted_secrets s
    WHERE u.name='fanframe_supabase_url' AND s.name='fanframe_worker_secret'
      AND (EXISTS(SELECT 1 FROM public.generation_queue WHERE work_stage IN ('uploading','ready','submitting','running','uncertain','output'))
        OR EXISTS(SELECT 1 FROM public.generation_controls WHERE scope='global' AND (worker_seen_at IS NULL OR worker_seen_at<now()-interval '30 seconds')));
  $job$) $schedule$;
  EXECUTE $schedule$ SELECT cron.schedule('fanframe-generation-monitor','* * * * *','SELECT public.monitor_generation_operations()') $schedule$;
  EXECUTE $schedule$ SELECT cron.schedule('fanframe-health-check','*/5 * * * *', $job$
    SELECT net.http_post(url:=u.decrypted_secret||'/functions/v1/health-check',
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||s.decrypted_secret),
      body:='{}'::jsonb,timeout_milliseconds:=60000)
    FROM vault.decrypted_secrets u CROSS JOIN vault.decrypted_secrets s
    WHERE u.name='fanframe_supabase_url' AND s.name='fanframe_worker_secret';
  $job$) $schedule$;
END $$;
REVOKE ALL ON FUNCTION public.install_generation_schedule() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.install_generation_schedule() TO service_role;
