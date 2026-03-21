UPDATE teams 
SET generation_prompt = (SELECT value FROM system_settings WHERE key = 'generation_prompt')
WHERE slug = 'corinthians' AND generation_prompt IS NULL;