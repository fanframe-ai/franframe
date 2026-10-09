-- Legacy primary owners use wp:<id>; retargeting that base can expose old results.
CREATE FUNCTION public.preserve_wordpress_primary_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF rtrim(NEW.wordpress_api_base,'/') IS DISTINCT FROM rtrim(OLD.wordpress_api_base,'/')
    AND OLD.wordpress_api_base IS NOT NULL
    AND (EXISTS(SELECT 1 FROM fanframe_sessions WHERE team_id=OLD.id)
         OR EXISTS(SELECT 1 FROM generation_queue WHERE team_id=OLD.id AND owner_id LIKE 'wp:%'))
 THEN RAISE EXCEPTION 'wordpress_primary_identity_immutable'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preserve_wordpress_primary_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_wordpress_primary_identity BEFORE UPDATE OF wordpress_api_base ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.preserve_wordpress_primary_identity();
