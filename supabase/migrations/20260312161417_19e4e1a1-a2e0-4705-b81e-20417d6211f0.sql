UPDATE public.system_settings 
SET value = 'Virtual try-on: Transform this person to wear the Corinthians jersey (Timão).

RULES:
- Preserve the person''s face, body proportions and pose exactly
- Replace only the upper body clothing with the Corinthians jersey
- Ensure realistic fabric folds and natural fit
- Place the person in the museum background setting
- Match lighting to indoor museum environment
- Maintain photorealistic quality, 8K resolution, sharp focus
- Professional DSLR camera quality',
    updated_at = now()
WHERE key = 'generation_prompt';