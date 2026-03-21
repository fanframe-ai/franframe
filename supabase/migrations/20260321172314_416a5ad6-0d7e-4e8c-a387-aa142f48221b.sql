
-- Seed Corinthians as the first team
INSERT INTO public.teams (slug, name, subdomain, wordpress_api_base, purchase_urls, replicate_api_token, generation_prompt, shirts, backgrounds, tutorial_assets, primary_color, secondary_color, watermark_url)
VALUES (
  'corinthians',
  'Corinthians',
  'ffcorinthians',
  'https://timaotourvirtual.com.br/wp-json/vf-fanframe/v1',
  '{"credits1": "https://timaotourvirtual.com.br/checkout?add-to-cart=67822", "credits3": "https://timaotourvirtual.com.br/checkout?add-to-cart=67824", "credits7": "https://timaotourvirtual.com.br/checkout?add-to-cart=67825"}',
  NULL,
  NULL,
  '[{"id": "manto-1", "name": "Manto I – O Timão", "subtitle": "O clássico alvinegro que carrega a história", "imageUrl": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/shirts/manto-1.png", "assetPath": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/shirts/manto-1.png", "promptDescription": "white Corinthians soccer jersey with black details, Nike logo on chest, Corinthians team crest in center, classic alvinegro design"}, {"id": "manto-2", "name": "Manto II – O Fiel", "subtitle": "A força que vem da Fiel Torcida", "imageUrl": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/shirts/manto-2.png", "assetPath": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/shirts/manto-2.png", "promptDescription": "black Corinthians away soccer jersey with white accents, Nike logo on chest, Corinthians team crest in center"}, {"id": "manto-3", "name": "Manto III – O Bando de Loucos", "subtitle": "Atitude e paixão corintiana", "imageUrl": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/shirts/manto-3.png", "assetPath": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/shirts/manto-3.png", "promptDescription": "dark grey Corinthians third jersey with black and white details, Nike logo on chest, Corinthians team crest"}]',
  '[{"id": "mural", "name": "Mural dos Ídolos", "subtitle": "Os maiores craques do Corinthians", "imageUrl": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/backgrounds/mural.png", "assetPath": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/backgrounds/mural.png"}, {"id": "memorial", "name": "Memorial do Corinthians", "subtitle": "A história do Timão", "imageUrl": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/backgrounds/memorial.jpg", "assetPath": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/backgrounds/memorial.jpg"}, {"id": "idolos", "name": "Galeria dos Ídolos", "subtitle": "Os maiores ídolos corintianos", "imageUrl": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/backgrounds/idolos.jpg", "assetPath": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/backgrounds/idolos.jpg"}, {"id": "trofeus", "name": "Sala de Troféus", "subtitle": "A história em conquistas", "imageUrl": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/backgrounds/trofeus.jpg", "assetPath": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/backgrounds/trofeus.jpg"}]',
  '{"before": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/tutorial/before.jpg", "after": "https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets/tutorial/after.png"}',
  '#000000',
  '#FFFFFF',
  '/watermark.webp'
);

-- Update existing records to point to corinthians team
UPDATE public.generations SET team_id = (SELECT id FROM public.teams WHERE slug = 'corinthians') WHERE team_id IS NULL;
UPDATE public.generation_queue SET team_id = (SELECT id FROM public.teams WHERE slug = 'corinthians') WHERE team_id IS NULL;
