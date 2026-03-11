CREATE POLICY "Public can read settings"
ON public.system_settings
FOR SELECT
TO anon
USING (true);