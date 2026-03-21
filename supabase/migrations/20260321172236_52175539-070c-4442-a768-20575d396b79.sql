
-- Create teams table for multi-tenant support
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  
  -- WordPress / FanFrame API
  wordpress_api_base TEXT NOT NULL,
  purchase_urls JSONB DEFAULT '{}',
  
  -- Replicate
  replicate_api_token TEXT,
  generation_prompt TEXT,
  
  -- Assets
  shirts JSONB NOT NULL DEFAULT '[]',
  backgrounds JSONB NOT NULL DEFAULT '[]',
  tutorial_assets JSONB DEFAULT '{}',
  
  -- Branding
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#FFFFFF',
  logo_url TEXT,
  watermark_url TEXT,
  
  -- Controle
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add team_id to existing tables
ALTER TABLE public.generations ADD COLUMN team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.generation_queue ADD COLUMN team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.daily_stats ADD COLUMN team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.system_alerts ADD COLUMN team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.consent_logs ADD COLUMN team_id UUID REFERENCES public.teams(id);

-- RLS for teams table
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Anyone can read active teams (needed for frontend to resolve team by subdomain)
CREATE POLICY "Anyone can read active teams" ON public.teams
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Admins can manage teams
CREATE POLICY "Admins can manage teams" ON public.teams
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Trigger to auto-update updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for subdomain lookups
CREATE INDEX idx_teams_subdomain ON public.teams(subdomain);
CREATE INDEX idx_teams_slug ON public.teams(slug);
