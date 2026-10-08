BEGIN;
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS wordpress_api_base text;
UPDATE public.teams
SET wordpress_api_base = 'https://tricolorvirtualexperience.net/wp-json/vf-fanframe/v1'
WHERE id = 'd3829d29-3c6e-4363-856e-c80306a4838e'
  AND slug = 'saopaulo-sp7k2x';
NOTIFY pgrst, 'reload schema';
COMMIT;
