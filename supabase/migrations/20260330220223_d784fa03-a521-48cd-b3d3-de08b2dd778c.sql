
CREATE TABLE public.test_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  label text NOT NULL DEFAULT 'Link de teste',
  credits_total integer NOT NULL DEFAULT 5,
  credits_used integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.test_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage test links"
ON public.test_links FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Anyone can read active test links"
ON public.test_links FOR SELECT
TO anon, authenticated
USING (is_active = true);
