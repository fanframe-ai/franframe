-- Hosted pgcrypto lives in extensions; plain PostgreSQL may use public.
SET LOCAL search_path = public, extensions;

-- Private credentials are never part of public team configuration.
CREATE TABLE public.team_secrets (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  replicate_api_token text
);
INSERT INTO public.team_secrets SELECT id, replicate_api_token FROM public.teams;
ALTER TABLE public.teams DROP COLUMN replicate_api_token;
ALTER TABLE public.team_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators manage team credentials" ON public.team_secrets
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.fanframe_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  external_user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  UNIQUE(team_id, token_hash)
);
ALTER TABLE public.fanframe_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.teams ALTER COLUMN wordpress_api_base DROP NOT NULL;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS purchase_urls jsonb;
UPDATE public.teams SET purchase_urls='{}' WHERE purchase_urls IS NULL;
ALTER TABLE public.teams ALTER COLUMN purchase_urls SET DEFAULT '{}';
ALTER TABLE public.teams ALTER COLUMN purchase_urls SET NOT NULL;
ALTER TABLE public.generation_queue ADD COLUMN owner_id text;
ALTER TABLE public.generation_queue ADD COLUMN test_link_id uuid REFERENCES public.test_links(id);
ALTER TABLE public.generation_queue ADD COLUMN result_storage_path text;
ALTER TABLE public.generation_queue ADD COLUMN webhook_signing_key text;
ALTER TABLE public.generation_queue ADD COLUMN request_hash text;
ALTER TABLE public.generation_queue ADD COLUMN credit_reserved boolean NOT NULL DEFAULT false;
ALTER TABLE public.generation_queue ADD COLUMN billing_completed boolean NOT NULL DEFAULT false;
CREATE INDEX generation_queue_owner ON public.generation_queue(team_id, owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_queue_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','processing','awaiting_payment','completed','failed') THEN
    RAISE EXCEPTION 'Invalid generation status';
  END IF;
  RETURN NEW;
END $$;

-- Replace permissive legacy policies. Service role bypasses RLS; clients do not.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN
      ('generation_queue','generations','test_links','consent_logs','rate_limits','system_settings','health_checks')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I',item.policyname,item.schemaname,item.tablename); END LOOP;
END $$;
CREATE POLICY "Administrators read queue" ON public.generation_queue FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Administrators read generations" ON public.generations FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Administrators manage test links" ON public.test_links FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Administrators read consent" ON public.consent_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Administrators read rate limits" ON public.rate_limits FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Administrators manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Administrators manage checks" ON public.health_checks FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Service role can insert alerts" ON public.system_alerts;
ALTER TABLE public.test_links ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(24), 'hex');
ALTER TABLE public.test_links ADD CONSTRAINT valid_test_credits CHECK (credits_used >= 0 AND credits_total >= credits_used);

DROP POLICY IF EXISTS "Allow uploads to tryon-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates to tryon-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for tryon-temp" ON storage.objects;
DROP POLICY IF EXISTS "Service role upload for tryon-temp" ON storage.objects;
DROP POLICY IF EXISTS "Service role delete for tryon-temp" ON storage.objects;
CREATE POLICY "Administrators upload assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='tryon-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "Administrators update assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='tryon-assets' AND public.is_admin(auth.uid())) WITH CHECK (bucket_id='tryon-assets' AND public.is_admin(auth.uid()));
UPDATE storage.buckets SET public=false WHERE id='tryon-temp';
UPDATE public.health_checks SET service_id='replicate', service_name='API IA (Replicate)' WHERE service_id='openai';

-- Move legacy display overrides into the owning team's asset JSON.
UPDATE public.teams AS team SET shirts = (
  SELECT jsonb_agg(asset || jsonb_strip_nulls(jsonb_build_object(
    'name', override.value->>'name', 'subtitle', override.value->>'subtitle',
    'visible', CASE WHEN override.value ? 'hidden' THEN NOT (override.value->>'hidden')::boolean ELSE NULL END
  )))
  FROM jsonb_array_elements(team.shirts) AS asset
  CROSS JOIN LATERAL (SELECT settings.value::jsonb -> (asset->>'id') AS value) AS override
)
FROM public.system_settings AS settings
WHERE team.slug='corinthians' AND settings.key='shirts_text_overrides';
UPDATE public.teams AS team SET backgrounds = (
  SELECT jsonb_agg(asset || jsonb_strip_nulls(jsonb_build_object(
    'name', override.value->>'name', 'subtitle', override.value->>'subtitle',
    'visible', CASE WHEN override.value ? 'hidden' THEN NOT (override.value->>'hidden')::boolean ELSE NULL END
  )))
  FROM jsonb_array_elements(team.backgrounds) AS asset
  CROSS JOIN LATERAL (SELECT settings.value::jsonb -> (asset->>'id') AS value) AS override
)
FROM public.system_settings AS settings
WHERE team.slug='corinthians' AND settings.key='backgrounds_text_overrides';

-- Reservation, idempotency and test credit decrement share one transaction.
CREATE FUNCTION public.reserve_generation(
  p_id uuid, p_team uuid, p_owner text, p_hash text, p_test_link uuid,
  p_balance integer, p_shirt text, p_shirt_url text, p_background_url text,
  p_consent text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job public.generation_queue; link public.test_links; active_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_team::text || ':' || p_owner,0));
  SELECT * INTO job FROM generation_queue WHERE id=p_id FOR UPDATE;
  IF FOUND THEN
    IF job.team_id <> p_team OR job.owner_id <> p_owner OR job.request_hash <> p_hash THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN jsonb_build_object('created',false,'id',job.id,'status',job.status);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM teams WHERE id=p_team AND is_active) THEN RAISE EXCEPTION 'team_unavailable'; END IF;
  IF (SELECT count(*) FROM generation_queue WHERE team_id=p_team AND owner_id=p_owner AND created_at>now()-interval '1 hour') >= 25 THEN
    RAISE EXCEPTION 'rate_limit_exceeded';
  END IF;
  IF p_test_link IS NOT NULL THEN
    SELECT * INTO link FROM test_links WHERE id=p_test_link AND team_id=p_team FOR UPDATE;
    IF NOT FOUND OR NOT link.is_active OR (link.expires_at IS NOT NULL AND link.expires_at<=now()) THEN RAISE EXCEPTION 'invalid_test_link'; END IF;
    IF link.credits_used >= link.credits_total THEN RAISE EXCEPTION 'no_credits'; END IF;
    UPDATE test_links SET credits_used=credits_used+1 WHERE id=p_test_link;
  ELSE
    SELECT count(*) INTO active_count FROM generation_queue WHERE team_id=p_team AND owner_id=p_owner AND status IN ('pending','processing','awaiting_payment');
    IF p_balance <= active_count THEN RAISE EXCEPTION 'no_credits'; END IF;
  END IF;
  INSERT INTO generation_queue(id,team_id,owner_id,user_id,test_link_id,request_hash,shirt_id,user_image_url,shirt_asset_url,background_asset_url,credit_reserved)
    VALUES(p_id,p_team,p_owner,p_owner,p_test_link,p_hash,p_shirt,'',p_shirt_url,p_background_url,p_test_link IS NOT NULL);
  INSERT INTO generations(id,team_id,external_user_id,shirt_id,status) VALUES(p_id,p_team,p_owner,p_shirt,'pending');
  INSERT INTO consent_logs(team_id,user_id,consent_text) VALUES(p_team,p_owner,p_consent);
  RETURN jsonb_build_object('created',true,'id',p_id,'status','pending');
END $$;

CREATE FUNCTION public.fail_generation(p_id uuid, p_error text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job generation_queue;
BEGIN
  SELECT * INTO job FROM generation_queue WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR job.status IN ('failed','completed','awaiting_payment') THEN RETURN; END IF;
  IF job.credit_reserved THEN
    UPDATE test_links SET credits_used=greatest(0,credits_used-1) WHERE id=job.test_link_id;
  END IF;
  UPDATE generation_queue SET status='failed',credit_reserved=false,error_message=p_error,completed_at=now() WHERE id=p_id;
  UPDATE generations SET status='failed',error_message=p_error,completed_at=now() WHERE id=p_id;
END $$;

CREATE FUNCTION public.finish_generation(p_id uuid, p_path text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job generation_queue; next_status text;
BEGIN
  SELECT * INTO job FROM generation_queue WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR job.status IN ('failed','completed','awaiting_payment') THEN RETURN; END IF;
  next_status := CASE WHEN job.test_link_id IS NOT NULL THEN 'completed' ELSE 'awaiting_payment' END;
  UPDATE generation_queue SET status=next_status,result_storage_path=p_path,credit_reserved=false,
    billing_completed=(test_link_id IS NOT NULL),completed_at=now() WHERE id=p_id;
  UPDATE generations SET status=CASE WHEN next_status='completed' THEN 'completed'::generation_status ELSE 'processing'::generation_status END,
    completed_at=now(),processing_time_ms=extract(epoch FROM now()-job.created_at)*1000 WHERE id=p_id;
END $$;

CREATE FUNCTION public.confirm_generation_payment(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE generation_queue SET status='completed',billing_completed=true WHERE id=p_id AND status='awaiting_payment';
  IF FOUND THEN UPDATE generations SET status='completed',completed_at=now() WHERE id=p_id; END IF;
END $$;

REVOKE ALL ON FUNCTION public.reserve_generation(uuid,uuid,text,text,uuid,integer,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_generation(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_generation(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.confirm_generation_payment(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_generation(uuid,uuid,text,text,uuid,integer,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_generation(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_generation(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_generation_payment(uuid) TO service_role;
GRANT ALL ON public.team_secrets,public.fanframe_sessions TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.team_secrets TO authenticated;
REVOKE ALL ON public.fanframe_sessions FROM anon,authenticated;
