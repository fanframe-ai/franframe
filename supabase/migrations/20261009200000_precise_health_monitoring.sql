-- Versioned observations separate legacy latency heuristics from confirmed failures.
ALTER TABLE public.health_checks DROP CONSTRAINT health_checks_status_check;
ALTER TABLE public.health_checks ADD CONSTRAINT health_checks_status_check CHECK(status IN ('operational','degraded','partial_outage','major_outage','unknown'));
ALTER TABLE public.health_checks ADD COLUMN probe_version integer NOT NULL DEFAULT 1, ADD COLUMN run_id uuid;
CREATE INDEX health_checks_version_created ON public.health_checks(probe_version,created_at DESC);
CREATE FUNCTION public.system_status_snapshot() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin_required'; END IF;
  WITH observations AS (
    SELECT * FROM health_checks WHERE probe_version=2 AND created_at>=now()-interval '90 days'
  ), latest AS (
    SELECT DISTINCT ON(service_id) service_id,status,response_time_ms,error_message,created_at,run_id FROM observations ORDER BY service_id,created_at DESC,id DESC
  ), stats AS (
    SELECT service_id,count(*) FILTER(WHERE status<>'unknown') AS checked,
      count(*) FILTER(WHERE status IN ('operational','degraded')) AS available,count(*) FILTER(WHERE status='unknown') AS unknown_checks,
      round(100.0*count(*) FILTER(WHERE status IN ('operational','degraded'))/nullif(count(*) FILTER(WHERE status<>'unknown'),0),2) AS availability,
      min(created_at) AS since FROM observations WHERE created_at>=now()-interval '30 days' GROUP BY service_id
  ), days AS (
    SELECT service_id,(created_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,count(*) AS checks,
      count(*) FILTER(WHERE status IN ('operational','degraded')) AS available,count(*) FILTER(WHERE status='operational') AS operational,
      count(*) FILTER(WHERE status='degraded') AS degraded,count(*) FILTER(WHERE status IN ('partial_outage','major_outage')) AS failed,
      count(*) FILTER(WHERE status='unknown') AS unknown_checks FROM observations GROUP BY 1,2
  ) SELECT jsonb_build_object('observed_at',now(),'latest',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM latest l),'[]'::jsonb),
    'stats',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM stats s),'[]'::jsonb),
    'days',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY date,service_id) FROM days d),'[]'::jsonb)) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.system_status_snapshot() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.system_status_snapshot() TO authenticated;
