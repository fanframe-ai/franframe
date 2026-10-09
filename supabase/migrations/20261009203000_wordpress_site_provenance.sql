ALTER TABLE public.teams ADD COLUMN wordpress_sites jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(wordpress_sites)='array' AND jsonb_array_length(wordpress_sites)<=3);
ALTER TABLE public.fanframe_sessions ADD COLUMN wordpress_api_base text;
UPDATE public.fanframe_sessions s SET wordpress_api_base=rtrim(t.wordpress_api_base,'/') FROM public.teams t WHERE t.id=s.team_id AND t.wordpress_api_base IS NOT NULL;
CREATE FUNCTION public.bind_fanframe_session(p_team uuid,p_external text,p_hash text,p_expires timestamptz,p_base text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM teams t WHERE t.id=p_team AND t.is_active AND (rtrim(t.wordpress_api_base,'/')=p_base OR EXISTS(SELECT 1 FROM jsonb_array_elements(t.wordpress_sites) s WHERE rtrim(s->>'api_base','/')=p_base))) THEN RAISE EXCEPTION 'invalid_wordpress_origin'; END IF;
 IF p_expires IS NULL OR p_hash IS NULL OR p_external IS NULL OR p_base IS NULL OR p_expires<=now() OR p_hash !~ '^[a-f0-9]{64}$' OR p_external !~ '^[0-9]+$' OR p_base !~ '^https://' THEN RAISE EXCEPTION 'invalid_session'; END IF;
 INSERT INTO fanframe_sessions(team_id,external_user_id,token_hash,expires_at,wordpress_api_base)
 VALUES(p_team,p_external,p_hash,p_expires,p_base)
 ON CONFLICT(team_id,token_hash) DO UPDATE SET expires_at=excluded.expires_at,wordpress_api_base=excluded.wordpress_api_base
 WHERE fanframe_sessions.external_user_id=excluded.external_user_id AND coalesce(fanframe_sessions.wordpress_api_base,(SELECT rtrim(wordpress_api_base,'/') FROM teams WHERE id=p_team))=excluded.wordpress_api_base;
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN affected=1;
END $$;
REVOKE ALL ON FUNCTION public.bind_fanframe_session(uuid,text,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bind_fanframe_session(uuid,text,text,timestamptz,text) TO service_role;
