SET LOCAL search_path = public;

-- Absorb a bounded burst without increasing provider concurrency or budgets.
UPDATE public.generation_controls SET max_waiting=60,updated_at=now()
WHERE scope='global' AND max_waiting<60;

CREATE FUNCTION public.generation_admission(p_team uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE item generation_controls;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM teams WHERE id=p_team AND is_active) THEN RAISE EXCEPTION 'team_unavailable'; END IF;
  FOR item IN SELECT * FROM generation_controls WHERE scope IN ('global',p_team::text) LOOP
    IF item.admissions_paused THEN RETURN jsonb_build_object('available',false,'reason','admissions_paused'); END IF;
  END LOOP;
  FOR item IN SELECT * FROM generation_controls WHERE scope IN ('global',p_team::text) LOOP
    IF (SELECT count(*) FROM generation_queue WHERE work_stage IN ('uploading','ready') AND (item.scope='global' OR team_id=p_team))>=item.max_waiting THEN
      RETURN jsonb_build_object('available',false,'reason','queue_full');
    END IF;
  END LOOP;
  RETURN jsonb_build_object('available',true);
END $$;
REVOKE ALL ON FUNCTION public.generation_admission(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generation_admission(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_generation_work() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE controls generation_controls; job generation_queue; kind text;
BEGIN
  SELECT * INTO controls FROM generation_controls WHERE scope='global' FOR UPDATE;
  UPDATE generation_controls SET worker_seen_at=now() WHERE scope='global';
  UPDATE generation_queue SET work_stage='uncertain',lease_id=null,lease_until=null
    WHERE work_stage='submitting' AND lease_until<now();
  -- Ready inputs need time to drain a burst; incomplete uploads still expire promptly.
  SELECT * INTO job FROM generation_queue
    WHERE (work_stage='uploading' AND created_at<now()-interval '10 minutes')
       OR (work_stage='ready' AND created_at<now()-interval '30 minutes')
    ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF FOUND THEN PERFORM fail_generation(job.id,'Nao foi possivel iniciar a foto neste momento. Seu credito foi preservado.'); END IF;
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
      ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
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
